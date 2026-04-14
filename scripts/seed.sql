-- Seed data for SwimSentry configurator
-- Apply with: npx wrangler d1 execute swimsentry-db --file=scripts/seed.sql --remote

-- Clear existing data (order respects FK constraints)
DELETE FROM persona_bundles;
DELETE FROM persona_factors;
DELETE FROM personas;
DELETE FROM custom_build_parts;
DELETE FROM custom_builds;
DELETE FROM preselections;
DELETE FROM build_sessions;
DELETE FROM chat_sessions;
DELETE FROM bom_links;
DELETE FROM bom_selections;
DELETE FROM sensor_tier_parts;
DELETE FROM hub_tier_parts;
DELETE FROM saved_configs;
DELETE FROM sensor_tiers;
DELETE FROM hub_tiers;
DELETE FROM hub_types;

-- Hub types
INSERT INTO hub_types (id, name, badge, badge_class, description, specs) VALUES
  ('none', 'No hub', 'Standalone', 'badge-none', 'Each sensor streams directly over WiFi to your AI server. Simplest setup — no hub hardware needed.', '["WiFi direct","No hub cost","Higher sensor power"]'),
  ('zigbee', 'Zigbee hub', 'Zigbee 3.0', 'badge-zigbee', 'Low-power mesh network. Sensors sync to a central coordinator which forwards to your AI stack via MQTT.', '["50–100m mesh","250 kbps","Ultra-low power"]'),
  ('lorawan', 'LoRaWAN gateway', 'LoRa 915MHz', 'badge-lora', 'Maximum range for large properties. Sub-GHz radio reaches 500m–5km. Gateway runs ChirpStack.', '["500m–5km","0.3–50 kbps","Best battery life"]');

-- Hub tiers — Zigbee
INSERT INTO hub_tiers (id, hub_type_id, name, badge, badge_class, description, price, specs) VALUES
  ('zigbee-cheap', 'zigbee', 'Zigbee hub — budget', 'Budget', 'badge-budget', 'ESP32-C6 as a lightweight Zigbee coordinator with basic MQTT bridge. Minimal cost.', 2800, '["ESP32-C6","10–40m range","Basic"]'),
  ('zigbee-premium', 'zigbee', 'Zigbee hub — premium', 'Premium', 'badge-premium', 'Raspberry Pi 5 + SMLIGHT SLZB-06. Full Home Assistant OS, web dashboard, OTA updates, 200+ device support.', 22500, '["Pi 5 + SLZB-06","50–100m mesh","Full HA dashboard"]');

-- Hub tiers — LoRaWAN
INSERT INTO hub_tiers (id, hub_type_id, name, badge, badge_class, description, price, specs) VALUES
  ('lora-cheap', 'lorawan', 'LoRaWAN gateway — budget', 'Budget', 'badge-budget', 'Raspberry Pi Zero 2W + SX1302 HAT. Runs lightweight ChirpStack. Compact and affordable.', 11500, '["Pi Zero 2W + SX1302","500m–2km","Compact"]'),
  ('lora-premium', 'lorawan', 'LoRaWAN gateway — premium', 'Premium', 'badge-premium', 'Raspberry Pi 5 + SX1302 HAT. Full ChirpStack + Node-RED, maximum range and processing headroom.', 26500, '["Pi 5 + SX1302","500m–5km","Full ChirpStack"]');

-- Hub tier parts
INSERT INTO hub_tier_parts (hub_tier_id, name, description, price, sort_order) VALUES
  ('zigbee-cheap', 'ESP32-C6 dev board', 'Zigbee/Thread coordinator firmware, external antenna', 1500, 1),
  ('zigbee-cheap', '5V USB-C wall adapter', 'Always-on power supply', 800, 2),
  ('zigbee-cheap', 'Small ABS enclosure', 'Basic indoor protection', 500, 3),
  ('zigbee-premium', 'Raspberry Pi 5 8GB', 'Quad-core A76, runs Home Assistant + Zigbee2MQTT', 13200, 1),
  ('zigbee-premium', 'SMLIGHT SLZB-06', 'Zigbee 3.0 coordinator, +20dB amp, PoE/USB/WiFi', 4500, 2),
  ('zigbee-premium', 'Samsung EVO 64GB A2 microSD', 'For Home Assistant OS image', 1000, 3),
  ('zigbee-premium', 'Official Pi 5 27W USB-C PSU', 'Stable 24/7 power delivery', 1500, 4),
  ('zigbee-premium', 'Argon ONE V5 case + fan', 'Aluminum cooling case with GPIO access', 2300, 5),
  ('lora-cheap', 'Raspberry Pi Zero 2W', 'Quad-core, WiFi, compact gateway host', 2000, 1),
  ('lora-cheap', 'Waveshare SX1302 915M HAT', '8-ch LoRaWAN concentrator, +26dBm, GNSS', 6500, 2),
  ('lora-cheap', 'Samsung EVO 32GB A2 microSD', 'For ChirpStack OS', 800, 3),
  ('lora-cheap', '5V 2.5A USB micro PSU', 'Stable power for Pi Zero', 1000, 4),
  ('lora-cheap', 'Pi Zero case', 'Basic enclosure with HAT clearance', 1200, 5),
  ('lora-premium', 'Raspberry Pi 5 8GB', 'Quad-core A76, runs ChirpStack + MQTT bridge', 13200, 1),
  ('lora-premium', 'Waveshare SX1302 915M HAT', '8-ch LoRaWAN gateway, +26dBm, -141dBm rx', 7500, 2),
  ('lora-premium', 'Samsung EVO 64GB A2 microSD', 'For ChirpStack OS image', 1000, 3),
  ('lora-premium', 'Official Pi 5 27W USB-C PSU', 'Stable 24/7 power delivery', 1500, 4),
  ('lora-premium', 'Argon ONE V5 case + fan', 'Aluminum cooling with HAT clearance', 2300, 5),
  ('lora-premium', '5dBi 915MHz antenna + GPS antenna', 'Included with HAT', 1000, 6);

-- Sensor tiers
INSERT INTO sensor_tiers (id, hub_type_id, name, badge, badge_class, description, price, battery, comm_range, accent_color, specs) VALUES
  ('sa-cheap', 'none', 'Standalone sensor — budget', 'Budget', 'badge-budget', 'Freenove ESP32-S3 CAM with OV2640. Direct WiFi MJPEG streaming to your AI endpoint.', 6400, '2–6 mo', 'WiFi ~30m', '#00e5a0', '["ESP32-S3 + OV2640","WiFi streaming","LD2410C mmWave"]'),
  ('sa-premium', 'none', 'Standalone sensor — premium', 'Premium', 'badge-premium', 'ESP32-S3 with OV5640 5MP. Higher-res streaming for better AI accuracy. Premium enclosure.', 8200, '1–4 mo', 'WiFi ~30m', '#3b82f6', '["ESP32-S3 + OV5640 5MP","HD WiFi stream","LD2410C mmWave"]'),
  ('zb-cheap', 'zigbee', 'Zigbee sensor — budget', 'Budget', 'badge-budget', 'ESP32-C6 with Zigbee radio + OV2640 triggered snapshots. Ultra-low power, months of battery.', 5400, '3–12 mo', '50–100m mesh', '#a78bfa', '["ESP32-C6 Zigbee","OV2640 snapshots","LD2410C mmWave"]'),
  ('zb-premium', 'zigbee', 'Zigbee sensor — premium', 'Premium', 'badge-premium', 'ESP32-C6 premium + OV5640 5MP snapshots. External antenna for extended mesh range.', 8200, '3–12 mo', '50–100m mesh', '#3b82f6', '["ESP32-C6 ext. antenna","OV5640 5MP","LD2410C mmWave"]'),
  ('lr-cheap', 'lorawan', 'LoRa sensor — budget', 'Budget', 'badge-budget', 'ESP32 + SX1262 LoRa radio. Ultra-long range with compressed snapshot payloads.', 6800, '6–24 mo', '500m–5km', '#f59e0b', '["ESP32 + SX1262","LoRa 915MHz","LD2410C mmWave"]'),
  ('lr-premium', 'lorawan', 'LoRa sensor — premium', 'Premium', 'badge-premium', 'ESP32 LoRa + OV5640 5MP + external antenna. Maximum range and image fidelity.', 9500, '6–18 mo', '1–5km+', '#3b82f6', '["ESP32 + SX1262 ext ant","OV5640 5MP","LD2410C mmWave"]');

-- Sensor tier parts
INSERT INTO sensor_tier_parts (sensor_tier_id, name, description, price, sort_order) VALUES
  ('sa-cheap', 'Freenove ESP32-S3 CAM', 'OV2640 2MP, 8MB PSRAM, WiFi/BLE, MJPEG stream', 2000, 1),
  ('sa-cheap', 'HLK-LD2410C mmWave radar', '24GHz FMCW, 5m range, static+motion, UART/GPIO', 800, 2),
  ('sa-cheap', '3.7V 350mAh LiPo battery', 'JST PH2.0, with protection board', 700, 3),
  ('sa-cheap', 'GITRUAX IP67 clear-lid box', '5.9"x5.9"x3.5", stainless latches', 1800, 4),
  ('sa-cheap', 'Wiring + desiccant + sealant kit', 'Dupont wires, silica gel, silicone, glands', 600, 5),
  ('sa-cheap', 'USB-C programming cable', 'One-time initial flash', 500, 6),
  ('sa-premium', 'Freenove ESP32-S3 CAM (OV5640)', '5MP sensor, 16MB flash, RTSP capable', 2800, 1),
  ('sa-premium', 'HLK-LD2410C mmWave radar', '24GHz FMCW, 5m range, static+motion, UART/GPIO', 800, 2),
  ('sa-premium', 'INMP441 I2S digital microphone', 'High-sensitivity splash/voice detection', 400, 3),
  ('sa-premium', '3.7V 500mAh LiPo battery', 'Higher capacity for HD streaming', 900, 4),
  ('sa-premium', 'TICONN large IP67 clear-lid box', '8.7"x6.7"x4.3", stainless hardware', 2200, 5),
  ('sa-premium', 'Wiring + desiccant + standoffs kit', 'Premium assembly consumables', 600, 6),
  ('sa-premium', 'USB-C programming cable', 'One-time initial flash', 500, 7),
  ('zb-cheap', 'ESP32-C6 dev board', 'Zigbee/Thread/ESP-NOW, ultra-low-power', 1100, 1),
  ('zb-cheap', 'OV2640 camera module', '2MP triggered snapshots, DVP interface', 600, 2),
  ('zb-cheap', 'HLK-LD2410C mmWave radar', '24GHz, 5m range, static+motion, UART', 800, 3),
  ('zb-cheap', '3.7V 350mAh LiPo battery', 'Months of deep-sleep operation', 700, 4),
  ('zb-cheap', 'GITRUAX IP67 clear-lid box', '5.9"x5.9"x3.5", pool splash proof', 1800, 5),
  ('zb-cheap', 'Wiring + desiccant + sealant', 'Assembly consumables', 400, 6),
  ('zb-premium', 'ESP32-C6 board (premium, ext ant)', 'Extra memory, U.FL external antenna port', 1600, 1),
  ('zb-premium', 'OV5640 camera module', '5MP high-res triggered snapshots', 2200, 2),
  ('zb-premium', 'HLK-LD2410C mmWave radar', '24GHz FMCW, 5m presence detection', 800, 3),
  ('zb-premium', '3.7V 350mAh LiPo battery', 'Dedicated rechargeable per-sensor', 700, 4),
  ('zb-premium', 'TICONN large IP67 clear-lid box', '8.7"x6.7"x4.3", stainless hardware', 2200, 5),
  ('zb-premium', 'Wiring + desiccant + standoffs', 'Premium assembly consumables', 700, 6),
  ('lr-cheap', 'Heltec ESP32 LoRa V3 (SX1262)', 'Integrated LoRa radio, 915MHz, OLED', 2300, 1),
  ('lr-cheap', 'OV2640 camera module', '2MP compressed snapshots over LoRa', 600, 2),
  ('lr-cheap', 'HLK-LD2410C mmWave radar', '24GHz, 5m range, human presence', 800, 3),
  ('lr-cheap', '3.7V 350mAh LiPo battery', 'Excellent life with LoRa deep sleep', 700, 4),
  ('lr-cheap', 'GITRUAX IP67 clear-lid box', '5.9"x5.9"x3.5", pool splash proof', 1800, 5),
  ('lr-cheap', 'Wiring + desiccant + sealant', 'Assembly consumables', 600, 6),
  ('lr-premium', 'Heltec ESP32 LoRa V3 (SX1262)', 'Integrated LoRa, 915MHz, deep sleep', 2300, 1),
  ('lr-premium', 'OV5640 camera module', '5MP high-res compressed snapshots', 2200, 2),
  ('lr-premium', 'HLK-LD2410C mmWave radar', '24GHz FMCW, 5m presence detection', 800, 3),
  ('lr-premium', 'INMP441 I2S digital microphone', 'Splash/voice detection trigger', 400, 4),
  ('lr-premium', '3.7V 500mAh LiPo battery', 'Higher capacity for premium sensor load', 900, 5),
  ('lr-premium', 'TICONN large IP67 clear-lid box', 'Premium stainless hardware', 2200, 6),
  ('lr-premium', 'Wiring + desiccant + standoffs', 'Premium assembly consumables', 700, 7);

-- Personas
INSERT INTO personas (id, name, tagline, description, icon, sort_order) VALUES
  ('family-suburban', 'Family Home', 'Kids, pets, peace of mind', 'Typical suburban home with a backyard pool. Primary concern is child safety with fast alert times.', 'Home', 1),
  ('airbnb-host', 'Vacation Rental', 'Protect guests, protect liability', 'Short-term rental property where the owner may not be on-site. Liability protection and guest safety are key.', 'Palmtree', 2),
  ('estate-luxury', 'Luxury Estate', 'Full coverage, no compromises', 'Large property with premium requirements. Multiple zones, professional-grade hardware, maximum reliability.', 'Castle', 3),
  ('community-pool', 'Community / HOA', 'Multi-zone, multi-user', 'Shared community pool or HOA facility. Requires robust coverage, multiple notification targets, and staff alerts.', 'Building2', 4),
  ('rural-homestead', 'Rural Property', 'Long range, solar powered', 'Remote property where the pool may be far from the house. Long-range communication and solar power are essential.', 'TreePine', 5),
  ('budget-conscious', 'Budget Setup', 'Maximum safety, minimum spend', 'Get essential pool safety monitoring at the lowest possible cost. Perfect for straightforward backyard pools.', 'PiggyBank', 6);

-- Persona factors
INSERT INTO persona_factors (persona_id, factor, label, value, importance, sort_order) VALUES
  ('family-suburban', 'distance_to_pool', 'Distance from house to pool', '20-50 ft', 'critical', 1),
  ('family-suburban', 'budget', 'Budget range', '$200-400', 'high', 2),
  ('family-suburban', 'kids', 'Children in household', '2+', 'critical', 3),
  ('family-suburban', 'response_time', 'Required response time', '<30 seconds', 'high', 4),
  ('family-suburban', 'notifications', 'Notification targets', 'Phone + smart speaker', 'medium', 5),
  ('airbnb-host', 'distance_to_pool', 'Owner distance', 'Remote (off-site)', 'high', 1),
  ('airbnb-host', 'budget', 'Budget range', '$100-250', 'high', 2),
  ('airbnb-host', 'guests', 'Guest awareness', 'Unknown guests, varying ages', 'critical', 3),
  ('airbnb-host', 'response_time', 'Alert latency tolerance', '<60 seconds', 'medium', 4),
  ('airbnb-host', 'notifications', 'Notification targets', 'Phone + email + guest display', 'high', 5),
  ('estate-luxury', 'distance_to_pool', 'Property coverage', '50-200 ft', 'high', 1),
  ('estate-luxury', 'budget', 'Budget range', '$500+, no limit', 'low', 2),
  ('estate-luxury', 'zones', 'Coverage zones', '2-4 zones', 'critical', 3),
  ('estate-luxury', 'response_time', 'Required response time', '<10 seconds', 'critical', 4),
  ('estate-luxury', 'notifications', 'Notification targets', 'Phone + security panel + intercom', 'high', 5),
  ('community-pool', 'distance_to_pool', 'Monitoring distance', 'On-site + remote', 'high', 1),
  ('community-pool', 'budget', 'Budget (shared cost)', '$400-800', 'medium', 2),
  ('community-pool', 'zones', 'Coverage zones', '3+ zones', 'critical', 3),
  ('community-pool', 'response_time', 'Required response time', '<15 seconds', 'critical', 4),
  ('community-pool', 'notifications', 'Notification targets', 'Staff radio + PA + dashboard', 'high', 5),
  ('rural-homestead', 'distance_to_pool', 'Distance from house to pool', '100-500 ft', 'critical', 1),
  ('rural-homestead', 'budget', 'Budget range', '$200-400', 'high', 2),
  ('rural-homestead', 'power', 'Power source', 'Solar required (no mains)', 'critical', 3),
  ('rural-homestead', 'response_time', 'Alert latency tolerance', '<120 seconds', 'medium', 4),
  ('rural-homestead', 'notifications', 'Notification targets', 'Phone + alarm', 'medium', 5),
  ('budget-conscious', 'distance_to_pool', 'Distance from house to pool', '<30 ft', 'medium', 1),
  ('budget-conscious', 'budget', 'Budget range', '<$100', 'critical', 2),
  ('budget-conscious', 'kids', 'Children in household', 'Any', 'high', 3),
  ('budget-conscious', 'response_time', 'Alert latency tolerance', '<60 seconds', 'medium', 4),
  ('budget-conscious', 'notifications', 'Notification targets', 'Phone only', 'low', 5);

-- Persona bundles
INSERT INTO persona_bundles (persona_id, label, hub_type_id, hub_tier_id, sensor_tier_id, qty, reasoning, sort_order) VALUES
  ('family-suburban', 'Recommended', 'zigbee', 'zigbee-cheap', 'zb-cheap', 4, 'Best balance of coverage and cost for a typical backyard pool. Zigbee mesh provides reliable connectivity at short range with excellent battery life.', 1),
  ('family-suburban', 'Budget Alternative', 'none', NULL, 'sa-cheap', 3, 'Skip the hub entirely and use WiFi-direct sensors. Lower upfront cost at the expense of slightly higher power consumption.', 2),
  ('airbnb-host', 'Recommended', 'none', NULL, 'sa-cheap', 2, 'Simplest setup for a rental — no hub to maintain. WiFi cameras stream directly. Minimal hardware for guests to tamper with.', 1),
  ('airbnb-host', 'Premium Option', 'zigbee', 'zigbee-cheap', 'zb-cheap', 3, 'If WiFi is unreliable at the property, Zigbee mesh adds resilience. Budget hub keeps costs manageable.', 2),
  ('estate-luxury', 'Recommended', 'zigbee', 'zigbee-premium', 'zb-premium', 8, 'Full Home Assistant dashboard with premium Zigbee mesh. 8 sensors cover multiple zones around a large pool and surrounding areas.', 1),
  ('estate-luxury', 'Long-Range Alternative', 'lorawan', 'lora-premium', 'lr-premium', 8, 'If the property is very large (>200ft), LoRaWAN provides km-range coverage. Premium gateway with ChirpStack for full control.', 2),
  ('community-pool', 'Recommended', 'zigbee', 'zigbee-premium', 'zb-premium', 8, 'Premium hub with Home Assistant provides a management dashboard for staff. 8 premium sensors cover the full facility with high-res imaging.', 1),
  ('rural-homestead', 'Recommended', 'lorawan', 'lora-cheap', 'lr-cheap', 4, 'LoRaWAN provides the range needed for rural properties. Budget tier keeps costs reasonable while delivering 500m-2km coverage.', 1),
  ('rural-homestead', 'Maximum Range', 'lorawan', 'lora-premium', 'lr-premium', 4, 'For very remote pools (500ft+), premium LoRa hardware with external antennas maximizes range and reliability.', 2),
  ('budget-conscious', 'Recommended', 'none', NULL, 'sa-cheap', 2, 'Two standalone WiFi sensors cover a small pool at the lowest possible cost. No hub needed — direct WiFi streaming.', 1),
  ('budget-conscious', 'Stretch Budget', 'zigbee', 'zigbee-cheap', 'zb-cheap', 3, 'A budget Zigbee hub ($28) adds mesh reliability and better battery life. Worth the small extra investment for more coverage.', 2);

-- Default saved configs
INSERT INTO saved_configs (name, hub_type_id, hub_tier_id, sensor_tier_id, qty, created_at, updated_at) VALUES
  ('Family Home', 'zigbee', 'zigbee-cheap', 'zb-cheap', 4, datetime('now'), datetime('now')),
  ('Budget Setup', 'none', NULL, 'sa-cheap', 2, datetime('now'), datetime('now')),
  ('Luxury Estate', 'zigbee', 'zigbee-premium', 'zb-premium', 8, datetime('now'), datetime('now')),
  ('Rural Property', 'lorawan', 'lora-cheap', 'lr-cheap', 4, datetime('now'), datetime('now'));
