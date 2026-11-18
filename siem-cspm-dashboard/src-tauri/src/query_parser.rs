pub fn parse_dsl_to_sql(dsl_query: &str) -> String {
    if dsl_query.trim().is_empty() {
        return "SELECT * FROM api_activity ORDER BY event_time DESC LIMIT 100".to_string();
    }

    // A very basic parser for `key:"value"` or `key:value` syntax
    let mut where_clauses = Vec::new();
    let parts = dsl_query.split_whitespace();

    for part in parts {
        if let Some((key, value)) = part.split_once(':') {
            let clean_value = value.trim_matches('"').trim_matches('\'');
            where_clauses.push(format!("{} = '{}'", key, clean_value));
        } else {
            // If it's just a loose term, maybe search in raw_data
            where_clauses.push(format!("raw_data LIKE '%{}%'", part));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        "".to_string()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    format!("SELECT * FROM api_activity {} ORDER BY event_time DESC LIMIT 100", where_sql)
}
