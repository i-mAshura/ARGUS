"""
Scalability Analysis for SpyderXDR
Capacity & Performance Modeling
"""

CURRENT_ARCHITECTURE_CAPACITY = {
    "Event Processing": {
        "throughput_per_second": 10000,
        "batch_size": 100,
        "concurrent_connections": 200,
        "detection_latency_ms": 100,
        "alert_generation_rate": "5-10% of events"
    },
    
    "Endpoint Support": {
        "current_single_instance": {
            "concurrent_agents": 500,
            "events_per_agent_per_minute": 50,
            "recommended_agents": 250
        },
        "docker_compose_single_server": {
            "recommended_endpoints": 500,
            "hardware_minimum": "16GB RAM, 8 CPU, 100GB SSD",
            "backend_instances": 1,
            "database_connections": 20
        },
        "kubernetes_cluster_3_nodes": {
            "estimated_endpoints": 5000,
            "backend_replicas": 10,
            "database_connections": 100
        },
        "kubernetes_cluster_10_nodes": {
            "estimated_endpoints": 25000,
            "backend_replicas": 30,
            "database_connections": 200
        },
        "enterprise_kubernetes_distributed": {
            "estimated_endpoints": 100000,
            "backend_replicas": 100,
            "database_connections": 500,
            "elasticsearch_nodes": 10,
            "redis_cluster_nodes": 6
        }
    },
    
    "Storage Requirements": {
        "events_per_endpoint_per_day": "10000-50000",
        "average_event_size_bytes": 500,
        "storage_per_endpoint_per_day_gb": 5,
        "storage_per_endpoint_per_year_gb": 1825,
        "database_size_1000_endpoints_90days_gb": 450,
        "elasticsearch_1000_endpoints_90days_gb": 300
    },
    
    "Network Requirements": {
        "bytes_per_event": 500,
        "bandwidth_1000_endpoints_mbps": 50,
        "bandwidth_10000_endpoints_mbps": 500,
        "bandwidth_100000_endpoints_mbps": 5000,
        "api_request_size_bytes": 2000,
        "api_response_size_bytes": 1000
    },
    
    "Alert Generation": {
        "critical_alerts_per_day_1000_endpoints": "500-2000",
        "high_alerts_per_day_1000_endpoints": "2000-5000",
        "medium_alerts_per_day_1000_endpoints": "5000-10000",
        "storage_per_alert_kb": 10
    }
}

# Scaling Formulas
SCALING_MODEL = {
    "agents": "N agents × 10-50 events/minute = base load",
    "detection_engines": "3 parallel × (event_processing_time_ms) = detection_latency",
    "database_connections": "ceil(N_agents / 5) connections needed",
    "redis_memory_gb": "(N_agents × avg_events × 0.5KB) / 1024",
    "elasticsearch_storage_gb": "(N_agents × daily_events × retention_days × 500B) / 1024^3",
    "backend_cpu_cores": "ceil(N_agents / 250)",
    "backend_memory_gb": "2 + (N_agents * 0.01)",
    "postgres_cpu_cores": "ceil(N_agents / 1000) + 2",
    "postgres_memory_gb": "4 + (N_agents * 0.005)"
}

# Recommended Deployment Sizes
DEPLOYMENT_TIERS = {
    "Small (SMB)": {
        "target_endpoints": "50-500",
        "recommended_deployment": "Docker Compose on Single Server",
        "hardware": "8GB RAM, 4 CPU, 50GB SSD",
        "estimated_cost_monthly": "$500-1000",
        "notes": "Good for initial deployment, development"
    },
    "Medium (Mid-Market)": {
        "target_endpoints": "500-5000",
        "recommended_deployment": "Docker Compose with Load Balancer",
        "hardware": "3 Servers: 16GB RAM, 8 CPU each",
        "estimated_cost_monthly": "$2000-5000",
        "notes": "Kubernetes or Docker Swarm ready"
    },
    "Large (Enterprise)": {
        "target_endpoints": "5000-50000",
        "recommended_deployment": "Kubernetes Cluster (5-10 nodes)",
        "hardware": "5-10 Nodes: 32GB RAM, 16 CPU each",
        "estimated_cost_monthly": "$10000-30000",
        "notes": "Auto-scaling, high availability, multi-region ready"
    },
    "Very Large (Enterprise+)": {
        "target_endpoints": "50000-500000",
        "recommended_deployment": "Multi-region Kubernetes with Sharding",
        "hardware": "50+ Nodes distributed across regions",
        "estimated_cost_monthly": "$50000+",
        "notes": "Distributed architecture, federated deployments"
    }
}

print("=" * 80)
print("SPYDERXDR SCALABILITY ANALYSIS")
print("=" * 80)
print(f"\nCURRENT CAPACITY:")
print(f"  Single Instance: {DEPLOYMENT_TIERS['Small (SMB)']['target_endpoints']} endpoints")
print(f"  Docker Compose: {DEPLOYMENT_TIERS['Small (SMB)']['target_endpoints']} endpoints")
print(f"  Docker Compose (Scaled): {DEPLOYMENT_TIERS['Medium (Mid-Market)']['target_endpoints']} endpoints")
print(f"  Kubernetes 3-node: ~5,000 endpoints")
print(f"  Kubernetes 10-node: ~25,000 endpoints")
print(f"  Kubernetes 50+ nodes: ~100,000+ endpoints")
print(f"\nTHROUGHPUT: {CURRENT_ARCHITECTURE_CAPACITY['Event Processing']['throughput_per_second']:,} events/second")
print(f"DETECTION LATENCY: {CURRENT_ARCHITECTURE_CAPACITY['Event Processing']['detection_latency_ms']}ms")
print(f"STORAGE: {CURRENT_ARCHITECTURE_CAPACITY['Storage Requirements']['storage_per_endpoint_per_day_gb']}GB/endpoint/day")
print("=" * 80)
