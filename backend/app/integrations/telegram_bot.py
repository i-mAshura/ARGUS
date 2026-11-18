"""Telegram bot integration for alert notifications"""
import logging
import os
from datetime import datetime
from telegram import Bot
from telegram.error import TelegramError

logger = logging.getLogger(__name__)

class TelegramAlertBot:
    """Telegram bot for sending security alerts"""
    
    PLACEHOLDER_TOKEN_MARKERS = ("secret_bot_token", "placeholder", "changeme", "your_bot_token")

    def __init__(self):
        # Configuration is loaded dynamically at dispatch time unless set explicitly (e.g. in tests)
        self.bot = None
        self.chat_id = None
        
    def _get_bot_and_chat_id(self):
        """Retrieve token and chat ID dynamically from config helper or environment"""
        from app.integrations.config_helper import get_integration_config
        config = get_integration_config("telegram")
        
        token = config.get("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = config.get("telegram_chat_id") or os.getenv("TELEGRAM_CHAT_ID")
        
        bot = None
        if token:
            token_text = str(token).strip()
            if any(marker in token_text.lower() for marker in self.PLACEHOLDER_TOKEN_MARKERS):
                logger.warning("Skipping Telegram bot initialization because the configured token looks like a placeholder.")
                return None, chat_id
            try:
                bot = Bot(token=token_text)
            except Exception as e:
                logger.error(f"Error initializing Telegram bot: {e}")

        return bot, chat_id
    
    async def log_telegram_dispatch(self, message: str):
        """Record Telegram alerting attempts in Redis for auditing logs"""
        try:
            from app.main import redis_service
            log_entry = f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
            await redis_service.lpush("telegram_alert_logs", [log_entry])
            
            # Cap the list to last 50 entries
            if hasattr(redis_service.client, 'ltrim'):
                await redis_service.client.ltrim("telegram_alert_logs", 0, 49)
            elif hasattr(redis_service.client, 'store') and "telegram_alert_logs" in redis_service.client.store:
                # Handle in-memory list slice trim for MockRedisClient
                redis_service.client.store["telegram_alert_logs"] = redis_service.client.store["telegram_alert_logs"][:50]
        except Exception as e:
            logger.error(f"Error logging Telegram alert to Redis: {e}")

    async def send_alert(self, alert: dict) -> bool:
        """Send alert notification to Telegram"""
        bot, chat_id = self._get_bot_and_chat_id()
        
        # Support test environment overrides
        if self.bot is not None:
            bot = self.bot
        if self.chat_id is not None:
            chat_id = self.chat_id

        if not bot or not chat_id:
            logger.warning("Telegram bot not configured (missing token or chat ID)")
            await self.log_telegram_dispatch("⚠️ Failed: Telegram bot token or chat ID not configured.")
            return False
        
        try:
            message = self._format_alert_message(alert)
            await bot.send_message(chat_id=chat_id, text=message, parse_mode="HTML")
            logger.info(f"Alert sent to Telegram: {alert.get('title')}")
            await self.log_telegram_dispatch(f"✅ Alert sent successfully: {alert.get('title')} ({alert.get('severity', 'unknown').upper()})")
            return True
        except Exception as e:
            logger.error(f"Error sending Telegram alert: {e}")
            await self.log_telegram_dispatch(f"❌ Error sending alert: {e}")
            return False
    
    async def send_critical_alert(self, alert: dict) -> bool:
        """Send critical alert with additional formatting"""
        bot, chat_id = self._get_bot_and_chat_id()
        
        # Support test environment overrides
        if self.bot is not None:
            bot = self.bot
        if self.chat_id is not None:
            chat_id = self.chat_id

        if not bot or not chat_id:
            logger.warning("Telegram bot not configured (missing token or chat ID)")
            await self.log_telegram_dispatch("⚠️ Failed: Telegram bot token or chat ID not configured.")
            return False
        
        try:
            message = self._format_critical_alert(alert)
            await bot.send_message(chat_id=chat_id, text=message, parse_mode="HTML")
            logger.warning(f"CRITICAL alert sent to Telegram: {alert.get('title')}")
            await self.log_telegram_dispatch(f"🚨 CRITICAL alert sent successfully: {alert.get('title')}")
            return True
        except Exception as e:
            logger.error(f"Error sending critical Telegram alert: {e}")
            await self.log_telegram_dispatch(f"❌ Error sending critical alert: {e}")
            return False
    
    def _format_alert_message(self, alert: dict) -> str:
        """Format alert for Telegram"""
        severity_emoji = {
            "critical": "🚨",
            "high": "⚠️",
            "medium": "⚡",
            "low": "ℹ️"
        }
        
        emoji = severity_emoji.get(alert.get("severity", "medium").lower(), "❓")
        
        message = f"""{emoji} <b>Security Alert</b>
        
<b>Title:</b> {alert.get('title', 'N/A')}
<b>Severity:</b> {alert.get('severity', 'unknown').upper()}
<b>Type:</b> {alert.get('detection_type', 'N/A')}
<b>Hostname:</b> {alert.get('hostname', 'unknown')}
<b>User:</b> {alert.get('user', 'unknown')}

<b>Description:</b>
{alert.get('description', 'N/A')}

<b>Time:</b> {alert.get('first_seen', 'N/A')}
"""
        return message
    
    def _format_critical_alert(self, alert: dict) -> str:
        """Format critical alert for Telegram"""
        tactics = alert.get('mitre_tactics', []) or ['N/A']
        if isinstance(tactics, str):
            tactics = [tactics]
        techniques = alert.get('mitre_techniques', []) or ['N/A']
        if isinstance(techniques, str):
            techniques = [techniques]
            
        message = f"""🔴 <b>CRITICAL SECURITY ALERT</b> 🔴

<b>{alert.get('title', 'Critical Security Event')}</b>

<b>Details:</b>
• Hostname: <code>{alert.get('hostname', 'unknown')}</code>
• User: <code>{alert.get('user', 'unknown')}</code>
• Detection Type: {alert.get('detection_type', 'N/A')}
• Time: {alert.get('first_seen', 'N/A')}

<b>MITRE ATT&CK:</b>
• Tactics: {', '.join(tactics)}
• Techniques: {', '.join(techniques)}

<b>Action Required:</b> Immediate investigation needed!
"""
        return message
