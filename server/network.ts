import os from 'node:os';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

function isWindows() {
  return process.platform === 'win32';
}

export type WifiNetwork = {
  ssid: string;
  bssids?: string[];
  signalPercent?: number; // best observed signal percent
  channel?: number;
  security?: string;
};

export type WifiStatus = {
  connected: boolean;
  ssid?: string;
  bssid?: string;
  signalPercent?: number;
  state?: string;
  radioType?: string;
  channel?: number;
  ipAddress?: string;
};

// Parse helpers for Windows netsh output
function parseWindowsNetworks(output: string): WifiNetwork[] {
  const lines = output.split(/\r?\n/);
  const networks: WifiNetwork[] = [];
  let current: WifiNetwork | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('SSID ') && line.includes(':')) {
      // Example: SSID 1 : MyWifi
      const parts = line.split(':');
      const ssid = parts.slice(1).join(':').trim();
      current = { ssid, bssids: [], signalPercent: undefined, security: undefined };
      networks.push(current);
    } else if (current && line.startsWith('BSSID ') && line.includes(':')) {
      const parts = line.split(':');
      const bssid = parts.slice(1).join(':').trim();
      current.bssids!.push(bssid);
    } else if (current && line.startsWith('Signal') && line.includes('%')) {
      const match = line.match(/(\d+)\%/);
      if (match) {
        const percent = parseInt(match[1], 10);
        current.signalPercent = Math.max(current.signalPercent ?? 0, percent);
      }
    } else if (current && line.startsWith('Channel') && line.includes(':')) {
      const ch = parseInt(line.split(':')[1].trim(), 10);
      if (!Number.isNaN(ch)) current.channel = ch;
    } else if (current && line.startsWith('Authentication') && line.includes(':')) {
      const sec = line.split(':')[1].trim();
      current.security = sec;
    }
  }

  return networks;
}

function parseWindowsInterface(output: string): WifiStatus {
  const lines = output.split(/\r?\n/).map(l => l.trim());
  const status: WifiStatus = { connected: false };
  for (const line of lines) {
    if (line.startsWith('State') && line.includes(':')) {
      const state = line.split(':')[1].trim();
      status.state = state;
      status.connected = /connected/i.test(state);
    } else if (line.startsWith('SSID') && line.includes(':')) {
      status.ssid = line.split(':')[1].trim();
    } else if (line.startsWith('BSSID') && line.includes(':')) {
      status.bssid = line.split(':')[1].trim();
    } else if (line.startsWith('Signal') && line.includes('%')) {
      const match = line.match(/(\d+)\%/);
      if (match) status.signalPercent = parseInt(match[1], 10);
    } else if (line.startsWith('Radio type') && line.includes(':')) {
      status.radioType = line.split(':')[1].trim();
    } else if (line.startsWith('Channel') && line.includes(':')) {
      const ch = parseInt(line.split(':')[1].trim(), 10);
      if (!Number.isNaN(ch)) status.channel = ch;
    }
  }

  // derive IP address from OS interfaces
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        status.ipAddress = net.address;
        break;
      }
    }
    if (status.ipAddress) break;
  }

  return status;
}

export async function scanWifiNetworks(): Promise<WifiNetwork[]> {
  if (isWindows()) {
    const { stdout } = await exec('netsh wlan show networks mode=Bssid');
    return parseWindowsNetworks(stdout);
  }
  throw new Error('Wi‑Fi scanning not supported on this platform');
}

export async function getWifiStatus(): Promise<WifiStatus> {
  if (isWindows()) {
    const { stdout } = await exec('netsh wlan show interfaces');
    return parseWindowsInterface(stdout);
  }
  // Fallback: infer connectivity from network interfaces
  const nets = os.networkInterfaces();
  let ip: string | undefined;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
        break;
      }
    }
    if (ip) break;
  }
  return { connected: !!ip, ipAddress: ip };
}

