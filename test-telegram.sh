#!/bin/bash
source .env.local
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"${TELEGRAM_CHAT_ID}\", \"message_thread_id\": ${TELEGRAM_THREAD_ID}, \"text\": \"test\"}"
