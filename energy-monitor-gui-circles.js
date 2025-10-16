/**
 * Original Circle View GUI - energy-monitor-gui-circles.js
 * Uses EnergyMonitorLogic for data processing
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
  type: 'energy-power-monitor-card',
  name: 'Energy Monitor - Circle View',
  description: "Displays power states for selected rooms in circles.",
  preview: true,
});

class EnergyandPowerMonitorCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      treeStructure: { type: Array },
      rooms: { type: Array },
    };
  }

  debugEnabled = false;

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EPM-Circles]', msg);
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
    this.debugLog('Fetching entity registry for rooms');
    if (!this.hass) {
      this.debugLog('hass not available yet');
      return;
    }
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
          friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                     .replace(/ (Power|Energy)$/gi, '')
                                     .trim();
          if (!friendlyName) friendlyName = entity.entity_id;
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      this.debugLog(`Found rooms: ${this.rooms.length}`);
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

  _renderTreeView(treeStructure) {
    const filtered = this.logic.filterTree(treeStructure);
    const renderItems = (items) => items.map(item => {
      const marginLeft = item.level * 60;
      const roomState = this.hass && this.hass.states ? this.hass.states[item.entity_id] : null;
      const showIcon = (this.config.show_icon) && roomState && roomState.attributes && roomState.attributes.icon;
      const normalDisplay = (item.value !== null && item.value !== undefined) ? this.logic.formatValue(item.value, item.unit) : '';
      const untrackedDisplay = (this.config.show_untracked_values && item.untrackedValue !== null && item.untrackedValue !== undefined)
        ? `U: ${this.logic.formatValue(item.untrackedValue, item.unit)}`
        : '';
      const friendlyNameDisplayInside = this.logic.splitAtNearestSpace(item.friendly_name).map(line => html`<div class="friendly-name-line">${line}</div>`);
      const circleBackground = this.logic.getBorderColor(item.percentage, item.untrackedValue);

      const circleStyle = `--circle-background: ${circleBackground};`;
      if (this.config.room_name_position === 'below' && this.config.show_name) {
        return html`
          <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0" aria-label="${item.friendly_name}">
            <div class="circle-wrapper">
              <div class="circle" data-entity-id="${item.entity_id}" style="${circleStyle}; width: var(--circle-size); height: var(--circle-size);">
                <div class="circle-content">
                  ${showIcon ? html`
                    <ha-icon 
                      style="--mdc-icon-size: ${this.config.icon_size}; position: relative; top: -5px;"
                      icon="${roomState.attributes.icon}">
                    </ha-icon>
                  ` : ''}
                  <div class="entity-value">${normalDisplay}</div>
                  ${untrackedDisplay ? html`<div class="untracked-value">${untrackedDisplay}</div>` : ''}
                </div>
              </div>
              <div class="room-name">${item.friendly_name}</div>
            </div>
          </div>
        `;
      } else {
        return html`
          <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0" aria-label="${item.friendly_name}">
            <div class="circle" data-entity-id="${item.entity_id}" style="${circleStyle}; width: var(--circle-size); height: var(--circle-size);">
              <div class="circle-content">
                ${showIcon ? html`
                  <ha-icon 
                    style="--mdc-icon-size: ${this.config.icon_size}; position: relative; top: -5px;"
                    icon="${roomState.attributes.icon}">
                  </ha-icon>
                ` : ''}
                ${this.config.room_name_position === 'inside' && this.config.show_name ? html`
                  <div class="room-name ${!showIcon ? 'no-icon' : ''}">${friendlyNameDisplayInside}</div>
                ` : ''}
                <div class="entity-value">${normalDisplay}</div>
                ${untrackedDisplay ? html`<div class="untracked-value">${untrackedDisplay}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      }
    });
    return renderItems(filtered);
  }

  _getStyleVariables() {
    const vars = this.logic.getStyleVariables();
    return `
      --tracked-value-size: ${vars.trackedValSize};
      --untracked-value-size: ${vars.untrackedValSize};
      --room-name-size: ${vars.roomNameSize};
      --icon-size: ${vars.iconSize};
      --circle-size: ${vars.circleSize};
      --circle-tracked-color: ${vars.trackedColor};
      --circle-untracked-color: ${vars.untrackedColor};
      --untracked-label-color: ${vars.untrackedLabelColor};
      --ring-width: ${vars.ringWidth}px;
    `;
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
      <ha-card style="${this._getStyleVariables()}">
        <div class="container">
          <div class="tree-view">
            ${this._renderTreeView(fullTree)}
          </div>
        </div>
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("energy-power-monitor-card-editor");
  }

  static get styles() {
    return css`
      :host { display: block; }
      .container { padding: 16px; text-align: center; }
      .circle-wrapper { display: inline-block; text-align: center; }
      .circle {
        position: relative;
        border-radius: 50%;
        display: inline-block;
        cursor: pointer;
        transition: background-color 0.3s;
        width: var(--circle-size, 80px);
        height: var(--circle-size, 80px);
      }

      .circle::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--circle-background, var(--circle-tracked-color, #3CB371));
        z-index: 0;
        will-change: background;
      }

      .circle::after {
        content: "";
        position: absolute;
        left: var(--ring-width, 6px);
        top: var(--ring-width, 6px);
        right: var(--ring-width, 6px);
        bottom: var(--ring-width, 6px);
        border-radius: 50%;
        background: var(--ha-card-background, var(--card-background-color, var(--paper-card-background-color, white)));
        z-index: 1;
        pointer-events: none;
      }

      .circle-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100%;
        width: 100%;
        padding: 10px;
        box-sizing: border-box;
        pointer-events: none;
      }

      .circle-content > * { pointer-events: auto; }
      .tree-item { position: relative; margin-bottom: 8px; }
      .tree-item[data-level]:not([data-level="0"])::before {
        content: "";
        position: absolute;
        left: -28px;
        top: 0;
        bottom: 0;
        border-left: 2px solid var(--divider-color, #e0e0e0);
      }
      .friendly-name-line { margin: 0; line-height: 1.2; }
      .room-name {
        margin: 0;
        font-size: var(--room-name-size, 10.5px);
        margin-top: 6px;
        white-space: nowrap;
      }
      .tree-view { margin-top: 10px; text-align: left; }
      .entity-value { text-align: center; font-size: var(--tracked-value-size, 10.5px); line-height: 1.1; color: white; }
      .untracked-value { text-align: center; font-size: var(--untracked-value-size, 10.5px); line-height: 1.1; margin-top: 2px; color: var(--untracked-label-color, grey); }
    `;
  }
}

customElements.define('energy-power-monitor-card', EnergyandPowerMonitorCard);

class EnergyandPowerMonitorCardEditor extends LitElement {
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
          const friendly = (this.hass.states[entityId]?.attributes.friendly_name || entityId).toLowerCase();
          if (!entityId.startsWith('sensor.energy_power_monitor_')) return false;
          if (this._logic._isUntrackedEntityId(entityId)) return false;
          if (friendly.includes('untracked')) return false;
          return true;
        })
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                     .replace(/ (Power|Energy)$/gi, '')
                                     .trim();
          if (!friendlyName) friendlyName = entity.entity_id;
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      if (!this._config.room && this.rooms.length > 0) {
        this._config.room = this.rooms[0].entity_id;
        this.fireConfigChanged();
      }
      this.requestUpdate();
    } catch (err) {
      console.debug('Editor _fetchRooms error', err);
    }
  }

  _roomChanged(ev) {
    const selectedRoom = ev.target.value;
    this._config = { ...this._config, room: selectedRoom };
    this.fireConfigChanged();
  }

  _toggleOption(ev) {
    const option = ev.target.name;
    let value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (option === 'decimal_precision') {
      value = parseInt(value);
      if (isNaN(value)) value = 1;
      value = Math.max(0, Math.min(3, value));
    }
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
    const fontSizeOptions = [];
    for (let i = 8; i <= 20; i += 0.5) fontSizeOptions.push(i.toFixed(1) + "px");
    const circleSizeOptions = [];
    for (let i = 50; i <= 200; i += 5) circleSizeOptions.push(i + "px");
    const iconSizeOptions = [];
    for (let i = 12; i <= 50; i += 1) iconSizeOptions.push(i + "px");
    const ringWidthOptions = ['2px','4px','6px','8px','10px','12px','16px'];
    const decimalOptions = [0,1,2,3];
    const selectedRoom = this._config?.room || "";

    return html`
      <style>
        .option-group { margin-bottom: 16px; border: 1px solid var(--divider-color, #e0e0e0); padding: 8px; border-radius: 4px; }
        .option-group h3 { margin: 0 0 8px 0; font-size: 12.5px; }
        .option { display: flex; align-items: center; margin-bottom: 6px; }
        .option label { flex: 0 0 200px; font-size: 12.5px; }
        .option input[type="checkbox"] { margin-left: auto; width: 16px; height: 16px; }
        .option input[type="color"], .option input[type="text"], .option select { flex: 1; font-size: 12.5px; padding: 2px; margin-left: 0; }
      </style>

      <div class="option-group">
        <h3>General Options</h3>
        <div class="option">
          <label for="room">Select Room:</label>
          <select id="room" @change="${this._roomChanged}">
            ${this.rooms.map(room => html`
              <option value="${room.entity_id}" ?selected="${room.entity_id === selectedRoom}">
                ${room.friendly_name}
              </option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="show_name">Show Name:</label>
          <input type="checkbox" id="show_name" name="show_name" .checked="${this._config.show_name !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="show_icon">Show Icon:</label>
          <input type="checkbox" id="show_icon" name="show_icon" .checked="${this._config.show_icon !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="show_untracked_values">Show Untracked Values:</label>
          <input type="checkbox" id="show_untracked_values" name="show_untracked_values" .checked="${this._config.show_untracked_values !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="combine_value_untracked">Combine Untracked Values:</label>
          <input type="checkbox" id="combine_value_untracked" name="combine_value_untracked" .checked="${this._config.combine_value_untracked !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="levels_to_show">Levels to Display:</label>
          <select id="levels_to_show" name="levels_to_show" @change="${this._toggleOption}">
            <option value="all" ?selected="${this._config.levels_to_show === 'all'}">All</option>
            <option value="selected" ?selected="${this._config.levels_to_show === 'selected'}">Only Selected</option>
            <option value="parents" ?selected="${this._config.levels_to_show === 'parents'}">All Parents</option>
            <option value="first" ?selected="${this._config.levels_to_show === 'first'}">1st Level Max</option>
          </select>
        </div>
      </div>

      <div class="option-group">
        <h3>Style Options</h3>
        <div class="option">
          <label for="tracked_color">Tracked Color:</label>
          <input type="color" id="tracked_color" name="tracked_color" .value="${this._config.tracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="untracked_color">Untracked Color:</label>
          <input type="color" id="untracked_color" name="untracked_color" .value="${this._config.untracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="color_untracked_label">Color Untracked Label:</label>
          <input type="checkbox" id="color_untracked_label" name="color_untracked_label" .checked="${this._config.color_untracked_label === true}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="room_name_position">Room Name Position:</label>
          <select id="room_name_position" name="room_name_position" @change="${this._toggleOption}">
            <option value="inside" ?selected="${this._config.room_name_position === 'inside'}">Inside</option>
            <option value="below" ?selected="${this._config.room_name_position === 'below'}">Below</option>
          </select>
        </div>
        <div class="option">
          <label for="remove_strings" title="Enter prefix(s) to remove (separated by ';') from child names">Remove prefix (sep. by ';'):</label>
          <input type="text" id="remove_strings" name="remove_strings" .value="${this._config.remove_strings}" @change="${this._toggleOption}">
        </div>

        <div class="option">
          <label for="tracked_value_size">Tracked Value Size:</label>
          <select id="tracked_value_size" name="tracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.tracked_value_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="untracked_value_size">Untracked Value Size:</label>
          <select id="untracked_value_size" name="untracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.untracked_value_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="room_name_size">Room Name Size:</label>
          <select id="room_name_size" name="room_name_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.room_name_size === size}">${size}</option>`)}
          </select>
        </div>

        <div class="option">
          <label for="icon_size">Icon Size:</label>
          <select id="icon_size" name="icon_size" @change="${this._toggleOption}">
            ${iconSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.icon_size === size}">${size}</option>`)}
          </select>
        </div>

        <div class="option">
          <label for="circle_size">Circle Size:</label>
          <select id="circle_size" name="circle_size" @change="${this._toggleOption}">
            ${circleSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.circle_size === size}">${size}</option>`)}
          </select>
        </div>

        <div class="option">
          <label for="ring_width">Ring Width:</label>
          <select id="ring_width" name="ring_width" @change="${this._toggleOption}">
            ${ringWidthOptions.map(v => html`
              <option value="${v}" ?selected="${this._config.ring_width === v}">${v}</option>
            `)}
          </select>
        </div>

        <div class="option">
          <label for="decimal_precision" title="Decimal places shown for numeric values">Decimal Precision:</label>
          <select id="decimal_precision" name="decimal_precision" @change="${this._toggleOption}">
            ${decimalOptions.map(d => html`<option value="${d}" ?selected="${this._config.decimal_precision === d}">${d}</option>`)}
          </select>
        </div>

      </div>
    `;
  }
}

customElements.define("energy-power-monitor-card-editor", EnergyandPowerMonitorCardEditor);