// Central API configuration
// Uses the environment variable set in docker-compose.yml, falls back to same-origin for production
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8001/api/v1`;

export default API_BASE_URL;
