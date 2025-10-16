/**
 * Bar Chart View GUI - energy-monitor-gui-bars.js
 * Alternative visualization: horizontal bars with percentage indicators
 * Import: import EnergyMonitorLogic from './energy-monitor-core.js';
 */

import {
  LitElement,
  html,
  css
} from "https://unpkg.com/lit-element@2.3.1/lit-element.js?module";

import EnergyMonitorLogic from './energy-monitor-core.js';

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-power-monitor-bars',
  name: 'Energy Monitor - Bar View',
  description: "Displays power states as horizontal bars.",
  preview: true,
});

class EnergyMonitorBarCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      rooms: { type: Array },
    };
  }

  debugEnabled = false;

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EPM-Bars]', msg);
  }

  setConfig(config) {
    this.debugLog('setConfig');
    this.logic = new EnergyMonitorLogic(config);
    this.config = this.logic.config;
    this.rooms = [];
    if (this.hass) this._fetchRooms().catch(e => this.debugLog(e));
  }

  updated(changed) {
    if (changed.has('hass')) {
      if (this.hass) this._fetchRooms().catch(e => this.debugLog(e));
    }
  }

  async _fetchRooms() {
    if (!this.hass) return;
    try {
      const entities = await this.hass.callWS({ type: 'config/entity_registry/list' });
      this.rooms = entities
        .filter(entity => {
          const entityId = entity.entity_id || '';
          const friendly = (this.hass.states[entityId]?.attributes.friendly_name || entityId).toLowerCase();
          if (!entityId.startsWith('sensor.energy_power_monitor_')) return false;
          if (this.logic._isUntrackedEntityId(entityId)) return false;
          if (friendly.includes('untracked')) return false;
          return true;
        })
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '').replace(/ (Power|Energy)$/gi, '').trim();
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      this.requestUpdate();
    } catch (err) {
      this.debugLog('Error fetching rooms: ' + err);
    }
  }

  _handleEntityClick(entityId) {
    if (this.isClickHandling) return;
    this.isClickHandling = true;
    const ev = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(ev);
    setTimeout(() => this.isClickHandling = false, 150);
  }
  isClickHandling = false;

  _renderBars(treeStructure) {
    const filtered = this.logic.filterTree(treeStructure);
    return filtered.map(item => {
      const paddingLeft = item.level * 20;
      const tracked = item.value || 0;
      const untracked = item.untrackedValue || 0;
      const total = tracked + untracked;
      const trackedPercent = total > 0 ? (tracked / total) * 100 : 100;
      const untrackedPercent = total > 0 ? (untracked / total) * 100 : 0;

      const normalDisplay = this.logic.formatValue(item.value, item.unit);
      const untrackedDisplay = this.config.show_untracked_values && item.untrackedValue !== null
        ? this.logic.formatValue(item.untrackedValue, item.unit)
        : '';

      return html`
        <div class="bar-item" style="padding-left: ${paddingLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0">
          <div class="bar-header">
            <div class="bar-name">${item.friendly_name}</div>
            <div class="bar-values">
              <span class="tracked-val">${normalDisplay}</span>
              ${untrackedDisplay ? html`<span class="untracked-val">${untrackedDisplay}</span>` : ''}
            </div>
          </div>
          <div class="bar-container">
            <div class="bar-track" style="width: ${trackedPercent}%; background-color: ${this.config.tracked_color};">
              <span class="bar-percent">${trackedPercent > 5 ? Math.round(trackedPercent) + '%' : ''}</span>
            </div>
            ${untrackedPercent > 0 ? html`
              <div class="bar-untracked" style="width: ${untrackedPercent}%; background-color: ${this.config.untracked_color};">
                <span class="bar-percent">${untrackedPercent > 5 ? Math.round(untrackedPercent) + '%' : ''}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
  }

  render() {
    if (!this.config) {
      return html`<ha-card><div style="padding:16px">Card not configured yet.</div></ha-card>`;
    }

    const selectedRoom = this.config.room;
    const roomState = selectedRoom ? (this.hass && this.hass.states ? this.hass.states[selectedRoom] : null) : null;
    if (!selectedRoom || !roomState) {
      return html`<ha-card><div style="padding:16px">No room selected or room entity not found.</div></ha-card>`;
    }

    const fullTree = this.logic.createTreeView(selectedRoom, this.hass.states);
    return html`
      <ha-card>
        <div class="container">
          <div class="bars-container">
            ${this._renderBars(fullTree)}
          </div>
        </div>
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("energy-power-monitor-bars-editor");
  }

  static get styles() {
    return css`
      :host { display: block; }
      .container { padding: 16px; }
      .bars-container { display: flex; flex-direction: column; gap: 12px; }
      .bar-item { cursor: pointer; padding: 8px; border-radius: 4px; transition: background-color 0.2s; }
      .bar-item:hover { background-color: rgba(0,0,0,0.05); }
      .bar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .bar-name { font-size: 13px; font-weight: 500; }
      .bar-values { display: flex; gap: 12px; font-size: 12px; }
      .tracked-val { color: #666; }
      .untracked-val { color: #999; font-size: 11px; }
      .bar-container { display: flex; height: 24px; border-radius: 4px; overflow: hidden; background-color: #f0f0f0; }
      .bar-track { display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; }
      .bar-untracked { display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; }
      .bar-percent { text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    `;
  }
}

customElements.define('energy-power-monitor-bars', EnergyMonitorBarCard);

class EnergyMonitorBarsEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      rooms: { type: Array }
    };
  }

  setConfig(config) {
    this._logic = new EnergyMonitorLogic(config);
    this._config = this._logic.config;
    this.rooms = [];
    if (this.hass) this._fetchRooms().catch(e => console.debug(e));
  }

  async _fetchRooms() {
    if (!this.hass) return;
    try {
      const entities = await this.hass.callWS({ type: 'config/entity_registry/list' });
      this.rooms = entities
        .filter(entity => {
          const entityId = entity.entity_id || '';
          if (!entityId.startsWith('sensor.energy_power_monitor_')) return false;
          if (this._logic._isUntrackedEntityId(entityId)) return false;
          return true;
        })
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '').replace(/ (Power|Energy)$/gi, '').trim();
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      if (!this._config.room && this.rooms.length > 0) {
        this._config.room = this.rooms[0].entity_id;
        this.fireConfigChanged();
      }
      this.requestUpdate();
    } catch (err) {
      console.debug('Error', err);
    }
  }

  _roomChanged(ev) {
    this._config = { ...this._config, room: ev.target.value };
    this.fireConfigChanged();
  }

  _toggleOption(ev) {
    const option = ev.target.name;
    let value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    this._config = { ...this._config, [option]: value };
    this.fireConfigChanged();
    this.requestUpdate();
  }

  fireConfigChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const selectedRoom = this._config?.room || "";
    return html`
      <style>
        .option-group { margin-bottom: 16px; border: 1px solid #e0e0e0; padding: 8px; border-radius: 4px; }
        .option { display: flex; align-items: center; margin-bottom: 6px; }
        .option label { flex: 0 0 150px; font-size: 12px; }
        .option select, .option input[type="color"] { flex: 1; }
      </style>
      <div class="option-group">
        <div class="option">
          <label>Select Room:</label>
          <select @change="${this._roomChanged}">
            ${this.rooms.map(room => html`
              <option value="${room.entity_id}" ?selected="${room.entity_id === selectedRoom}">
                ${room.friendly_name}
              </option>
            `)}
          </select>
        </div>
        <div class="option">
          <label>Show Untracked:</label>
          <input type="checkbox" name="show_untracked_values" .checked="${this._config.show_untracked_values !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label>Tracked Color:</label>
          <input type="color" name="tracked_color" .value="${this._config.tracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label>Untracked Color:</label>
          <input type="color" name="untracked_color" .value="${this._config.untracked_color}" @change="${this._toggleOption}">
        </div>
      </div>
    `;
  }
}

customElements.define("energy-power-monitor-bars-editor", EnergyMonitorBarsEditor);