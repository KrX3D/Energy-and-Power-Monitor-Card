/**
 * Card Grid View GUI - energy-monitor-gui-cards.js
 * Alternative visualization: modern card-based grid layout
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
  type: 'energy-power-monitor-cards',
  name: 'Energy Monitor - Card Grid View',
  description: "Displays power states as modern cards.",
  preview: true,
});

class EnergyMonitorCardGrid extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      rooms: { type: Array },
    };
  }

  debugEnabled = false;

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EPM-Cards]', msg);
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
          if (!entityId.startsWith('sensor.energy_power_monitor_')) return false;
          if (this.logic._isUntrackedEntityId(entityId)) return false;
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

  _getBackgroundColor(percentage) {
    if (percentage === 0) return 'rgba(46, 125, 50, 0.1)';
    if (percentage < 30) return 'rgba(56, 142, 60, 0.15)';
    if (percentage < 60) return 'rgba(251, 192, 45, 0.15)';
    return 'rgba(244, 67, 54, 0.15)';
  }

  _renderCards(treeStructure) {
    const filtered = this.logic.filterTree(treeStructure).filter(item => item.level <= 1);
    return filtered.map(item => {
      const tracked = item.value || 0;
      const untracked = item.untrackedValue || 0;
      const total = tracked + untracked;
      const trackedDisplay = this.logic.formatValue(item.value, item.unit);
      const untrackedDisplay = this.config.show_untracked_values && item.untrackedValue !== null
        ? this.logic.formatValue(item.untrackedValue, item.unit)
        : null;

      const bgColor = this._getBackgroundColor(item.percentage);
      const isCombined = this.config.combine_value_untracked && untrackedDisplay;

      return html`
        <div 
          class="card" 
          style="background-color: ${bgColor};"
          @click="${() => this._handleEntityClick(item.entity_id)}" 
          role="button" 
          tabindex="0"
        >
          <div class="card-header">
            <div class="card-title">${item.friendly_name}</div>
            ${item.level > 0 ? html`<div class="card-level">Level ${item.level}</div>` : ''}
          </div>

          <div class="card-body">
            <div class="value-section">
              <div class="value-label">Tracked</div>
              <div class="value-display">${trackedDisplay}</div>
            </div>

            ${untrackedDisplay ? html`
              <div class="value-section">
                <div class="value-label">Untracked</div>
                <div class="value-display untracked">${untrackedDisplay}</div>
              </div>
            ` : ''}

            ${isCombined ? html`
              <div class="value-section total">
                <div class="value-label">Total</div>
                <div class="value-display">${this.logic.formatValue(total, item.unit)}</div>
              </div>
            ` : ''}
          </div>

          ${untrackedDisplay ? html`
            <div class="card-footer">
              <div class="percentage-bar">
                <div class="percentage-fill" style="width: ${item.percentage}%; background-color: ${this.config.untracked_color};"></div>
              </div>
              <div class="percentage-text">Untracked: ${item.percentage}%</div>
            </div>
          ` : ''}
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
          <div class="cards-grid">
            ${this._renderCards(fullTree)}
          </div>
        </div>
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("energy-power-monitor-cards-editor");
  }

  static get styles() {
    return css`
      :host { display: block; }
      .container { padding: 16px; }
      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      .card {
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        border: 1px solid rgba(0,0,0,0.08);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      .card:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        transform: translateY(-2px);
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .card-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }
      .card-level {
        font-size: 10px;
        color: #999;
        background-color: rgba(0,0,0,0.06);
        padding: 2px 6px;
        border-radius: 3px;
      }
      .card-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }
      .value-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .value-section.total {
        border-top: 1px solid rgba(0,0,0,0.1);
        padding-top: 8px;
        margin-top: 4px;
        font-weight: 600;
      }
      .value-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .value-display {
        font-size: 16px;
        font-weight: 700;
        color: #2e7d32;
        font-family: 'Courier New', monospace;
      }
      .value-display.untracked {
        color: #f57c00;
      }
      .card-footer {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .percentage-bar {
        height: 6px;
        background-color: rgba(0,0,0,0.1);
        border-radius: 3px;
        overflow: hidden;
      }
      .percentage-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      .percentage-text {
        font-size: 11px;
        color: #999;
        text-align: center;
      }
    `;
  }
}

customElements.define('energy-power-monitor-cards', EnergyMonitorCardGrid);

class EnergyMonitorCardsEditor extends LitElement {
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
        .option select { flex: 1; }
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
          <label>Combine Values:</label>
          <input type="checkbox" name="combine_value_untracked" .checked="${this._config.combine_value_untracked !== false}" @change="${this._toggleOption}">
        </div>
      </div>
    `;
  }
}

customElements.define("energy-power-monitor-cards-editor", EnergyMonitorCardsEditor);