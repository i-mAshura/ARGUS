"""
Elasticsearch Service for SpyderXDR telemetry storage.

Replaces SQLite/Postgres as the primary event store for log search & retrieval.
Events are indexed into a `spyderxdr-events` index and queried via multi_match.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

ES_HOST = "http://localhost:9200"
ES_INDEX = "spyderxdr-events"


class ElasticSearchService:
    """
    Async wrapper around the official elasticsearch Python library.

    Usage:
        es = ElasticSearchService()
        await es.init_index()
        await es.index_event({"hostname": "...", "event_type": "...", ...})
        results = await es.search_events("powershell", limit=50)
        await es.close()
    """

    def __init__(self, host: str = ES_HOST):
        self._host = host
        self._client = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def start(self):
        """Create the async ES client connection."""
        from elasticsearch import AsyncElasticsearch

        self._client = AsyncElasticsearch(self._host, request_timeout=3)
        # Ping to verify connectivity
        try:
            info = await self._client.info()
            logger.info("✅ Elasticsearch connected – cluster: %s", info.get("cluster_name", "unknown"))
        except Exception as exc:
            logger.warning("⚠️ Elasticsearch not available at %s (%s). Falling back to database-only mode.", self._host, exc)
            try:
                await self._client.close()
            except Exception:
                pass
            self._client = None

    async def close(self):
        """Close the ES client, releasing connection pool resources."""
        if self._client is not None:
            await self._client.close()
            self._client = None
            logger.info("Elasticsearch client closed.")

    async def init_index(self) -> None:
        """
        Create the `spyderxdr-events` index if it doesn't exist,
        with an explicit mapping for the fields we query against.
        """
        if self._client is None:
            logger.warning("Elasticsearch unavailable — skipping index creation.")
            return

        index_body = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
            },
            "mappings": {
                "properties": {
                    "timestamp":       {"type": "date"},
                    "hostname":        {"type": "keyword"},
                    "event_type":      {"type": "keyword"},
                    "source_ip":       {"type": "ip"},
                    "destination_ip":  {"type": "ip"},
                    "agent_id":        {"type": "keyword"},
                    "status":          {"type": "keyword"},
                    "event_data":      {"type": "object", "dynamic": False},
                }
            },
        }

        try:
            exists = await self._client.indices.exists(index=ES_INDEX)
            if not exists:
                await self._client.indices.create(index=ES_INDEX, body=index_body)
                logger.info("✅ Created Elasticsearch index: %s", ES_INDEX)
            else:
                logger.info("Elasticsearch index %s already exists.", ES_INDEX)
        except Exception as exc:
            logger.error("Failed to create/verify index %s: %s", ES_INDEX, exc)
            raise

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    async def index_event(self, event_document: Dict[str, Any]) -> Optional[str]:
        """
        Index a single event document into Elasticsearch (async refresh).

        Uses the default (asynchronous) refresh policy so that the call returns
        immediately instead of waiting for the shard to refresh.

        Returns the Elasticsearch document ``_id`` on success, or ``None``
        if indexing failed (logged, not raised).
        """
        if self._client is None:
            logger.error("ElasticSearchService not started – cannot index event.")
            return None

        # Inject a document id if the caller provided one
        doc_id = event_document.pop("id", None)

        try:
            resp = await self._client.index(
                index=ES_INDEX,
                id=doc_id,
                document=event_document,
                # NOTE: no refresh param — uses default async refresh.
                # Documents are visible after the index's refresh_interval (default 1s).
            )
            doc_id = resp.get("_id")
            logger.debug("Indexed event %s into %s", doc_id, ES_INDEX)
            return doc_id
        except Exception as exc:
            logger.error("Failed to index event into Elasticsearch: %s", exc)
            return None

    async def bulk_index(self, documents: List[Dict[str, Any]]) -> Tuple[int, int]:
        """
        Bulk-index a list of event documents using ``helpers.async_bulk``.

        Parameters
        ----------
        documents : list[dict]
            List of event documents to index. Each dict may contain an optional
            ``"id"`` key used as the Elasticsearch ``_id``.

        Returns
        -------
        (success_count, error_count) tuple.
        """
        if self._client is None:
            logger.error("ElasticSearchService not started – cannot bulk index.")
            return 0, len(documents)

        from elasticsearch.helpers import async_bulk

        async def _generate_actions():
            for doc in documents:
                doc_id = doc.pop("id", None)
                action = {
                    "_index": ES_INDEX,
                    "_source": doc,
                }
                if doc_id is not None:
                    action["_id"] = doc_id
                yield action

        try:
            success, errors = await async_bulk(
                self._client,
                actions=_generate_actions(),
                raise_on_error=False,
                refresh=False,  # do NOT wait for refresh — let ES handle it asynchronously
            )
            if errors:
                logger.warning("Bulk index completed with %d errors out of %d docs", errors, len(documents))
            else:
                logger.debug("Bulk indexed %d documents into %s", success, ES_INDEX)
            return success, errors
        except Exception as exc:
            logger.error("Bulk index failed: %s", exc)
            return 0, len(documents)

    # ------------------------------------------------------------------
    # Count helpers
    # ------------------------------------------------------------------
    async def count_today(self) -> int:
        """
        Count how many events were indexed today (UTC).

        Returns the total count of documents whose ``timestamp`` field is
        >= the start of the current UTC day, or 0 if ES is unavailable.
        """
        if self._client is None:
            logger.warning("ElasticSearchService not started – cannot count.")
            return 0

        from datetime import datetime
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        try:
            resp = await self._client.count(
                index=ES_INDEX,
                body={
                    "query": {
                        "range": {
                            "timestamp": {
                                "gte": today_start.isoformat(),
                            }
                        }
                    }
                },
            )
            return int(resp.get("count", 0))
        except Exception as exc:
            logger.error("ES count_today failed: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    async def search_events(
        self,
        search_query: str,
        limit: int = 100,
        offset: int = 0,
        filters: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Full-text search across indexed event fields using multi_match.

        Parameters
        ----------
        search_query : str
            Free-text query (e.g. "powershell", "192.168", "sysmon").
        limit : int
            Maximum number of hits to return.
        offset : int
            Offset for pagination.
        filters : dict, optional
            Optional field-level filter (e.g. {"event_type": "sysmon"}).

        Returns
        -------
        dict with keys:
            - total  : int
            - events : list of flattened hit dicts
        """
        if self._client is None:
            logger.error("ElasticSearchService not started – cannot search.")
            return {"total": 0, "events": []}

        must_clauses = []

        if search_query.strip():
            # simple_query_string is more tolerant of user-input special chars
            # than query_string.  source_ip/destination_ip are excluded because
            # they are mapped as ES `ip` type and cannot participate in
            # full-text search with non-IP strings.
            # Search across mapped fields only. event_data is indexed with
            # dynamic: false (no auto-detected subfield mappings), so event_data.*
            # is excluded here — it would yield no matches.
            must_clauses.append({
                "simple_query_string": {
                    "query":            search_query.strip(),
                    "fields":           ["hostname^3", "event_type^3"],
                    "default_operator": "AND",
                    "lenient":          True,
                }
            })

        if filters:
            for field, value in filters.items():
                if value.strip():
                    if field in ("hostname", "event_type", "agent_id", "status"):
                        must_clauses.append({
                            "term": {
                                field: {
                                    "value": value.strip(),
                                    "case_insensitive": True
                                }
                            }
                        })
                    else:
                        must_clauses.append({"term": {field: value.strip()}})

        body = {"query": {"bool": {"must": must_clauses}}} if must_clauses else {"query": {"match_all": {}}}

        try:
            resp = await self._client.search(
                index=ES_INDEX,
                body=body,
                size=limit,
                from_=offset,
                sort=[{"timestamp": {"order": "desc"}}],
            )
            hits = resp.get("hits", {})
            total = hits.get("total", {}).get("value", 0)
            raw_hits = hits.get("hits", [])

            events = []
            for hit in raw_hits:
                src = hit.get("_source", {})
                src["id"] = hit.get("_id")
                events.append(src)

            return {"total": total, "events": events}

        except Exception as exc:
            logger.error("Elasticsearch search failed: %s", exc)
            return {"total": 0, "events": []}
