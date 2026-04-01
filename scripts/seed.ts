import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { hubTypes, hubTiers, hubTierParts, sensorTiers, sensorTierParts } from '../src/lib/schema';
import { sql } from 'drizzle-orm';

const sqlite = new Database('sqlite.db');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite);

// Clear existing data
db.run(sql`DELETE FROM sensor_tier_parts`);
db.run(sql`DELETE FROM hub_tier_parts`);
db.run(sql`DELETE FROM saved_configs`);
db.run(sql`DELETE FROM sensor_tiers`);
db.run(sql`DELETE FROM hub_tiers`);
db.run(sql`DELETE FROM hub_types`);

// Hub types
db.insert(hubTypes).values([
  {
    id: 'none', name: 'No hub', badge: 'Standalone', badgeClass: 'badge-none',
    description: 'Each sensor streams directly over WiFi to your AI server. Simplest setup — no hub hardware needed.',
    specs: JSON.stringify(['WiFi direct', 'No hub cost', 'Higher sensor power']),
  },
  {
    id: 'zigbee', name: 'Zigbee hub', badge: 'Zigbee 3.0', badgeClass: 'badge-zigbee',
    description: 'Low-power mesh network. Sensors sync to a central coordinator which forwards to your AI stack via MQTT.',
    specs: JSON.stringify(['50–100m mesh', '250 kbps', 'Ultra-low power']),
  },
  {
    id: 'lorawan', name: 'LoRaWAN gateway', badge: 'LoRa 915MHz', badgeClass: 'badge-lora',
    description: 'Maximum range for large properties. Sub-GHz radio reaches 500m–5km. Gateway runs ChirpStack.',
    specs: JSON.stringify(['500m–5km', '0.3–50 kbps', 'Best battery life']),
  },
]).run();

// Hub tiers — Zigbee
db.insert(hubTiers).values([
  {
    id: 'zigbee-cheap', hubTypeId: 'zigbee', name: 'Zigbee hub — budget',
    badge: 'Budget', badgeClass: 'badge-budget',
    description: 'ESP32-C6 as a lightweight Zigbee coordinator with basic MQTT bridge. Minimal cost.',
    price: 2800, specs: JSON.stringify(['ESP32-C6', '10–40m range', 'Basic']),
  },
  {
    id: 'zigbee-premium', hubTypeId: 'zigbee', name: 'Zigbee hub — premium',
    badge: 'Premium', badgeClass: 'badge-premium',
    description: 'Raspberry Pi 5 + SMLIGHT SLZB-06. Full Home Assistant OS, web dashboard, OTA updates, 200+ device support.',
    price: 22500, specs: JSON.stringify(['Pi 5 + SLZB-06', '50–100m mesh', 'Full HA dashboard']),
  },
]).run();

// Hub tiers — LoRaWAN
db.insert(hubTiers).values([
  {
    id: 'lora-cheap', hubTypeId: 'lorawan', name: 'LoRaWAN gateway — budget',
    badge: 'Budget', badgeClass: 'badge-budget',
    description: 'Raspberry Pi Zero 2W + SX1302 HAT. Runs lightweight ChirpStack. Compact and affordable.',
    price: 11500, specs: JSON.stringify(['Pi Zero 2W + SX1302', '500m–2km', 'Compact']),
  },
  {
    id: 'lora-premium', hubTypeId: 'lorawan', name: 'LoRaWAN gateway — premium',
    badge: 'Premium', badgeClass: 'badge-premium',
    description: 'Raspberry Pi 5 + SX1302 HAT. Full ChirpStack + Node-RED, maximum range and processing headroom.',
    price: 26500, specs: JSON.stringify(['Pi 5 + SX1302', '500m–5km', 'Full ChirpStack']),
  },
]).run();

// Hub tier parts — zigbee-cheap
db.insert(hubTierParts).values([
  { hubTierId: 'zigbee-cheap', name: 'ESP32-C6 dev board', description: 'Zigbee/Thread coordinator firmware, external antenna', price: 1500, sortOrder: 1 },
  { hubTierId: 'zigbee-cheap', name: '5V USB-C wall adapter', description: 'Always-on power supply', price: 800, sortOrder: 2 },
  { hubTierId: 'zigbee-cheap', name: 'Small ABS enclosure', description: 'Basic indoor protection', price: 500, sortOrder: 3 },
]).run();

// Hub tier parts — zigbee-premium
db.insert(hubTierParts).values([
  { hubTierId: 'zigbee-premium', name: 'Raspberry Pi 5 8GB', description: 'Quad-core A76, runs Home Assistant + Zigbee2MQTT', price: 13200, sortOrder: 1 },
  { hubTierId: 'zigbee-premium', name: 'SMLIGHT SLZB-06', description: 'Zigbee 3.0 coordinator, +20dB amp, PoE/USB/WiFi', price: 4500, sortOrder: 2 },
  { hubTierId: 'zigbee-premium', name: 'Samsung EVO 64GB A2 microSD', description: 'For Home Assistant OS image', price: 1000, sortOrder: 3 },
  { hubTierId: 'zigbee-premium', name: 'Official Pi 5 27W USB-C PSU', description: 'Stable 24/7 power delivery', price: 1500, sortOrder: 4 },
  { hubTierId: 'zigbee-premium', name: 'Argon ONE V5 case + fan', description: 'Aluminum cooling case with GPIO access', price: 2300, sortOrder: 5 },
]).run();

// Hub tier parts — lora-cheap
db.insert(hubTierParts).values([
  { hubTierId: 'lora-cheap', name: 'Raspberry Pi Zero 2W', description: 'Quad-core, WiFi, compact gateway host', price: 2000, sortOrder: 1 },
  { hubTierId: 'lora-cheap', name: 'Waveshare SX1302 915M HAT', description: '8-ch LoRaWAN concentrator, +26dBm, GNSS', price: 6500, sortOrder: 2 },
  { hubTierId: 'lora-cheap', name: 'Samsung EVO 32GB A2 microSD', description: 'For ChirpStack OS', price: 800, sortOrder: 3 },
  { hubTierId: 'lora-cheap', name: '5V 2.5A USB micro PSU', description: 'Stable power for Pi Zero', price: 1000, sortOrder: 4 },
  { hubTierId: 'lora-cheap', name: 'Pi Zero case', description: 'Basic enclosure with HAT clearance', price: 1200, sortOrder: 5 },
]).run();

// Hub tier parts — lora-premium
db.insert(hubTierParts).values([
  { hubTierId: 'lora-premium', name: 'Raspberry Pi 5 8GB', description: 'Quad-core A76, runs ChirpStack + MQTT bridge', price: 13200, sortOrder: 1 },
  { hubTierId: 'lora-premium', name: 'Waveshare SX1302 915M HAT', description: '8-ch LoRaWAN gateway, +26dBm, -141dBm rx', price: 7500, sortOrder: 2 },
  { hubTierId: 'lora-premium', name: 'Samsung EVO 64GB A2 microSD', description: 'For ChirpStack OS image', price: 1000, sortOrder: 3 },
  { hubTierId: 'lora-premium', name: 'Official Pi 5 27W USB-C PSU', description: 'Stable 24/7 power delivery', price: 1500, sortOrder: 4 },
  { hubTierId: 'lora-premium', name: 'Argon ONE V5 case + fan', description: 'Aluminum cooling with HAT clearance', price: 2300, sortOrder: 5 },
  { hubTierId: 'lora-premium', name: '5dBi 915MHz antenna + GPS antenna', description: 'Included with HAT', price: 1000, sortOrder: 6 },
]).run();

// Sensor tiers — standalone (none)
db.insert(sensorTiers).values([
  {
    id: 'sa-cheap', hubTypeId: 'none', name: 'Standalone sensor — budget',
    badge: 'Budget', badgeClass: 'badge-budget',
    description: 'Freenove ESP32-S3 CAM with OV2640. Direct WiFi MJPEG streaming to your AI endpoint.',
    price: 6400, battery: '2–6 mo', commRange: 'WiFi ~30m', accentColor: '#00e5a0',
    specs: JSON.stringify(['ESP32-S3 + OV2640', 'WiFi streaming', 'LD2410C mmWave']),
  },
  {
    id: 'sa-premium', hubTypeId: 'none', name: 'Standalone sensor — premium',
    badge: 'Premium', badgeClass: 'badge-premium',
    description: 'ESP32-S3 with OV5640 5MP. Higher-res streaming for better AI accuracy. Premium enclosure.',
    price: 8200, battery: '1–4 mo', commRange: 'WiFi ~30m', accentColor: '#3b82f6',
    specs: JSON.stringify(['ESP32-S3 + OV5640 5MP', 'HD WiFi stream', 'LD2410C mmWave']),
  },
]).run();

// Sensor tiers — zigbee
db.insert(sensorTiers).values([
  {
    id: 'zb-cheap', hubTypeId: 'zigbee', name: 'Zigbee sensor — budget',
    badge: 'Budget', badgeClass: 'badge-budget',
    description: 'ESP32-C6 with Zigbee radio + OV2640 triggered snapshots. Ultra-low power, months of battery.',
    price: 5400, battery: '3–12 mo', commRange: '50–100m mesh', accentColor: '#a78bfa',
    specs: JSON.stringify(['ESP32-C6 Zigbee', 'OV2640 snapshots', 'LD2410C mmWave']),
  },
  {
    id: 'zb-premium', hubTypeId: 'zigbee', name: 'Zigbee sensor — premium',
    badge: 'Premium', badgeClass: 'badge-premium',
    description: 'ESP32-C6 premium + OV5640 5MP snapshots. External antenna for extended mesh range.',
    price: 8200, battery: '3–12 mo', commRange: '50–100m mesh', accentColor: '#3b82f6',
    specs: JSON.stringify(['ESP32-C6 ext. antenna', 'OV5640 5MP', 'LD2410C mmWave']),
  },
]).run();

// Sensor tiers — lorawan
db.insert(sensorTiers).values([
  {
    id: 'lr-cheap', hubTypeId: 'lorawan', name: 'LoRa sensor — budget',
    badge: 'Budget', badgeClass: 'badge-budget',
    description: 'ESP32 + SX1262 LoRa radio. Ultra-long range with compressed snapshot payloads.',
    price: 6800, battery: '6–24 mo', commRange: '500m–5km', accentColor: '#f59e0b',
    specs: JSON.stringify(['ESP32 + SX1262', 'LoRa 915MHz', 'LD2410C mmWave']),
  },
  {
    id: 'lr-premium', hubTypeId: 'lorawan', name: 'LoRa sensor — premium',
    badge: 'Premium', badgeClass: 'badge-premium',
    description: 'ESP32 LoRa + OV5640 5MP + external antenna. Maximum range and image fidelity.',
    price: 9500, battery: '6–18 mo', commRange: '1–5km+', accentColor: '#3b82f6',
    specs: JSON.stringify(['ESP32 + SX1262 ext ant', 'OV5640 5MP', 'LD2410C mmWave']),
  },
]).run();

// Sensor tier parts — sa-cheap
db.insert(sensorTierParts).values([
  { sensorTierId: 'sa-cheap', name: 'Freenove ESP32-S3 CAM', description: 'OV2640 2MP, 8MB PSRAM, WiFi/BLE, MJPEG stream', price: 2000, sortOrder: 1 },
  { sensorTierId: 'sa-cheap', name: 'HLK-LD2410C mmWave radar', description: '24GHz FMCW, 5m range, static+motion, UART/GPIO', price: 800, sortOrder: 2 },
  { sensorTierId: 'sa-cheap', name: '3.7V 350mAh LiPo battery', description: 'JST PH2.0, with protection board', price: 700, sortOrder: 3 },
  { sensorTierId: 'sa-cheap', name: 'GITRUAX IP67 clear-lid box', description: '5.9"x5.9"x3.5", stainless latches', price: 1800, sortOrder: 4 },
  { sensorTierId: 'sa-cheap', name: 'Wiring + desiccant + sealant kit', description: 'Dupont wires, silica gel, silicone, glands', price: 600, sortOrder: 5 },
  { sensorTierId: 'sa-cheap', name: 'USB-C programming cable', description: 'One-time initial flash', price: 500, sortOrder: 6 },
]).run();

// Sensor tier parts — sa-premium
db.insert(sensorTierParts).values([
  { sensorTierId: 'sa-premium', name: 'Freenove ESP32-S3 CAM (OV5640)', description: '5MP sensor, 16MB flash, RTSP capable', price: 2800, sortOrder: 1 },
  { sensorTierId: 'sa-premium', name: 'HLK-LD2410C mmWave radar', description: '24GHz FMCW, 5m range, static+motion, UART/GPIO', price: 800, sortOrder: 2 },
  { sensorTierId: 'sa-premium', name: 'INMP441 I2S digital microphone', description: 'High-sensitivity splash/voice detection', price: 400, sortOrder: 3 },
  { sensorTierId: 'sa-premium', name: '3.7V 500mAh LiPo battery', description: 'Higher capacity for HD streaming', price: 900, sortOrder: 4 },
  { sensorTierId: 'sa-premium', name: 'TICONN large IP67 clear-lid box', description: '8.7"x6.7"x4.3", stainless hardware', price: 2200, sortOrder: 5 },
  { sensorTierId: 'sa-premium', name: 'Wiring + desiccant + standoffs kit', description: 'Premium assembly consumables', price: 600, sortOrder: 6 },
  { sensorTierId: 'sa-premium', name: 'USB-C programming cable', description: 'One-time initial flash', price: 500, sortOrder: 7 },
]).run();

// Sensor tier parts — zb-cheap
db.insert(sensorTierParts).values([
  { sensorTierId: 'zb-cheap', name: 'ESP32-C6 dev board', description: 'Zigbee/Thread/ESP-NOW, ultra-low-power', price: 1100, sortOrder: 1 },
  { sensorTierId: 'zb-cheap', name: 'OV2640 camera module', description: '2MP triggered snapshots, DVP interface', price: 600, sortOrder: 2 },
  { sensorTierId: 'zb-cheap', name: 'HLK-LD2410C mmWave radar', description: '24GHz, 5m range, static+motion, UART', price: 800, sortOrder: 3 },
  { sensorTierId: 'zb-cheap', name: '3.7V 350mAh LiPo battery', description: 'Months of deep-sleep operation', price: 700, sortOrder: 4 },
  { sensorTierId: 'zb-cheap', name: 'GITRUAX IP67 clear-lid box', description: '5.9"x5.9"x3.5", pool splash proof', price: 1800, sortOrder: 5 },
  { sensorTierId: 'zb-cheap', name: 'Wiring + desiccant + sealant', description: 'Assembly consumables', price: 400, sortOrder: 6 },
]).run();

// Sensor tier parts — zb-premium
db.insert(sensorTierParts).values([
  { sensorTierId: 'zb-premium', name: 'ESP32-C6 board (premium, ext ant)', description: 'Extra memory, U.FL external antenna port', price: 1600, sortOrder: 1 },
  { sensorTierId: 'zb-premium', name: 'OV5640 camera module', description: '5MP high-res triggered snapshots', price: 2200, sortOrder: 2 },
  { sensorTierId: 'zb-premium', name: 'HLK-LD2410C mmWave radar', description: '24GHz FMCW, 5m presence detection', price: 800, sortOrder: 3 },
  { sensorTierId: 'zb-premium', name: '3.7V 350mAh LiPo battery', description: 'Dedicated rechargeable per-sensor', price: 700, sortOrder: 4 },
  { sensorTierId: 'zb-premium', name: 'TICONN large IP67 clear-lid box', description: '8.7"x6.7"x4.3", stainless hardware', price: 2200, sortOrder: 5 },
  { sensorTierId: 'zb-premium', name: 'Wiring + desiccant + standoffs', description: 'Premium assembly consumables', price: 700, sortOrder: 6 },
]).run();

// Sensor tier parts — lr-cheap
db.insert(sensorTierParts).values([
  { sensorTierId: 'lr-cheap', name: 'Heltec ESP32 LoRa V3 (SX1262)', description: 'Integrated LoRa radio, 915MHz, OLED', price: 2300, sortOrder: 1 },
  { sensorTierId: 'lr-cheap', name: 'OV2640 camera module', description: '2MP compressed snapshots over LoRa', price: 600, sortOrder: 2 },
  { sensorTierId: 'lr-cheap', name: 'HLK-LD2410C mmWave radar', description: '24GHz, 5m range, human presence', price: 800, sortOrder: 3 },
  { sensorTierId: 'lr-cheap', name: '3.7V 350mAh LiPo battery', description: 'Excellent life with LoRa deep sleep', price: 700, sortOrder: 4 },
  { sensorTierId: 'lr-cheap', name: 'GITRUAX IP67 clear-lid box', description: '5.9"x5.9"x3.5", pool splash proof', price: 1800, sortOrder: 5 },
  { sensorTierId: 'lr-cheap', name: 'Wiring + desiccant + sealant', description: 'Assembly consumables', price: 600, sortOrder: 6 },
]).run();

// Sensor tier parts — lr-premium
db.insert(sensorTierParts).values([
  { sensorTierId: 'lr-premium', name: 'Heltec ESP32 LoRa V3 (SX1262)', description: 'Integrated LoRa, 915MHz, deep sleep', price: 2300, sortOrder: 1 },
  { sensorTierId: 'lr-premium', name: 'OV5640 camera module', description: '5MP high-res compressed snapshots', price: 2200, sortOrder: 2 },
  { sensorTierId: 'lr-premium', name: 'HLK-LD2410C mmWave radar', description: '24GHz FMCW, 5m presence detection', price: 800, sortOrder: 3 },
  { sensorTierId: 'lr-premium', name: 'INMP441 I2S digital microphone', description: 'Splash/voice detection trigger', price: 400, sortOrder: 4 },
  { sensorTierId: 'lr-premium', name: '3.7V 500mAh LiPo battery', description: 'Higher capacity for premium sensor load', price: 900, sortOrder: 5 },
  { sensorTierId: 'lr-premium', name: 'TICONN large IP67 clear-lid box', description: 'Premium stainless hardware', price: 2200, sortOrder: 6 },
  { sensorTierId: 'lr-premium', name: 'Wiring + desiccant + standoffs', description: 'Premium assembly consumables', price: 700, sortOrder: 7 },
]).run();

console.log('Seed complete. Inserted:');
console.log('  3 hub types');
console.log('  4 hub tiers');
console.log('  19 hub tier parts');
console.log('  6 sensor tiers');
console.log('  39 sensor tier parts');
