/**
 * MQTT pub/sub sync — no Firebase, no Supabase, no API keys.
 * Uses free public MQTT broker with retained messages.
 */
window.MQTT_CONFIG = window.MQTT_CONFIG || {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  topicPrefix: "daily-grocery/v1/households/"
};
