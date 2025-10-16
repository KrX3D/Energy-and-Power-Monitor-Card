/**
 * Table View GUI - energy-monitor-gui-table.js
 * Alternative visualization: clean table with all data
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
  type: 'energy-power-monitor-table',
  name: 'Energy Monitor - Table View',
  description: "Displays power states in a table format.",
  preview: true,
});

class EnergyMonitorTableCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      rooms: { type: Array },
    };
  }

  constructor() {
    super();
    this.debugEnabled = false;
    this.isClickHandling = false;
    this.logic = null;
    this.rooms = [];
  }

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EPM-Table]', msg);
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
    if (!this.hass || !this.logic) return;
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

  _renderTable(treeStructure) {
    const filtered = this.logic.filterTree(treeStructure);
    return html`
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Tracked Value</th>
            ${this.config.show_untracked_values ? html`<th>Untracked Value</th>` : ''}
            <th>Total</th>
            ${this.config.show_untracked_values ? html`<th>Untracked %</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${filtered.map(item => {
            const paddingLeft = item.level * 20;
            const tracked = item.value || 0;
            const untracked = item.untrackedValue || 0;
            const total = tracked + untracked;
            const trackedDisplay = this.logic.formatValue(item.value, item.unit);
            const untrackedDisplay = this.config.show_untracked_values && item.untrackedValue !== null
              ? this.logic.formatValue(item.untrackedValue, item.unit)
              : '-';
            const totalDisplay = this.logic.formatValue(total, item.unit);

            return html`
              <tr class="row-level-${item.level}" @click="${() => this._handleEntityClick(item.entity_id)}" role="button">
                <td style="padding-left: ${paddingLeft}px; font-weight: ${item.level === 0 ? 'bold' : 'normal'};" class="name-cell">${item.friendly_name}</td>
                <td class="value-cell tracked">${trackedDisplay}</td>
                ${this.config.show_untracked_values ? html`<td class="value-cell untracked">${untrackedDisplay}</td>` : ''}
                <td class="value-cell total">${totalDisplay}</td>
                ${this.config.show_untracked_values ? html`<td class="percent-cell">${item.percentage}%</td>` : ''}
              </tr>
            `;
          })}
        </tbody>
      </table>
    `;
  }

  render() {
    if (!this.config || !this.logic) {
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
          ${this._renderTable(fullTree)}
        </div>
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("energy-power-monitor-table-editor");
  }

  static get styles() {
    return css`
      :host { display: block; }
      .container { padding: 16px; }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .data-table thead {
        background-color: rgba(0,0,0,0.03);
        border-bottom: 2px solid rgba(0,0,0,0.12);
      }
      .data-table th {
        padding: 12px 8px;
        text-align: left;
        font-weight: 600;
        color: rgba(0,0,0,0.87);
      }
      .data-table td {
        padding: 10px 8px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      .data-table tbody tr {
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .data-table tbody tr:hover {
        background-color: rgba(0,0,0,0.02);
      }
      .data-table .row-level-0 {
        font-weight: 600;
        background-color: rgba(0,0,0,0.01);
      }
      .data-table .row-level-1 {
        background-color: rgba(0,0,0,0.005);
      }
      .name-cell { min-width: 150px; }
      .value-cell { text-align: right; font-variant-numeric: tabular-nums; }
      .value-cell.tracked { color: #2e7d32; }
      .value-cell.untracked { color: #666; }
      .value-cell.total { font-weight: 600; color: #333; }
      .percent-cell { text-align: center; color: #999; font-size: 12px; }
    `;
  }
}

customElements.define('energy-power-monitor-table', EnergyMonitorTableCard);

class EnergyMonitorTableEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      rooms: { type: Array }
    };
  }

  constructor() {
    super();
    this._config = {};
    this.rooms = [];
    this._logic = null;
  }

  setConfig(config) {
    this._logic = new EnergyMonitorLogic(config);
    this._config = this._logic.config;
    this.rooms = [];
    if (this.hass) this._fetchRooms().catch(e => console.debug(e));
  }

  async _fetchRooms() {
    if (!this.hass || !this._logic) return;
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
          <label>Levels to Show:</label>
          <select name="levels_to_show" @change="${this._toggleOption}">
            <option value="all" ?selected="${this._config.levels_to_show === 'all'}">All</option>
            <option value="selected" ?selected="${this._config.levels_to_show === 'selected'}">Only Selected</option>
            <option value="first" ?selected="${this._config.levels_to_show === 'first'}">1st Level Max</option>
          </select>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; }
    `;
  }
}

customElements.define("energy-power-monitor-table-editor", EnergyMonitorTableEditor);