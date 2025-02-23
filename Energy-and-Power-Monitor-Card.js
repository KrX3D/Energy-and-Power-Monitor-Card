import {
  LitElement,
  html,
  css
} from "https://unpkg.com/lit-element@2.3.1/lit-element.js?module";

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-power-monitor-card',
  name: 'Energy and Power Monitor',
  description: "Displays power states for selected rooms.",
  preview: false,
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

  debugEnabled = false; // Set to true to enable logging

  debugLog(message) {
    if (this.debugEnabled) {
      console.log(message);
    }
  }

  setConfig(config) {
    this.debugLog('Setting config...');
    // Note: The "clean_subelement_names" option is removed.
    this.config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      show_children: config.show_children !== false,
      // Style defaults:
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "below",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
      // New option: color untracked label (default false)
      color_untracked_label: config.color_untracked_label === true,
      // New option: remove_strings – a semicolon-separated list (default empty)
      remove_strings: config.remove_strings !== undefined ? config.remove_strings : "",
      room: config.room, // may be undefined initially
      ...config,
    };
    this.debugLog(`Config updated: ${JSON.stringify(this.config)}`);
    this.rooms = [];
    this._fetchRooms();
  }

  async _fetchRooms() {
    this.debugLog('Fetching rooms...');
    let entities = [];
    if (this.hass) {
      try {
        entities = await this.hass.callWS({
          type: 'config/entity_registry/list'
        });
        this.debugLog(`Entities fetched: ${entities.length} found.`);
      } catch (error) {
        this.debugLog(`Error fetching rooms: ${error}`);
        return;
      }
    } else {
      this.debugLog('this.hass is not yet available.');
      return;
    }
    this.rooms = entities
      .filter(entity =>
        entity.entity_id.startsWith('sensor.energy_power_monitor_') &&
        !(this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id)
          .toLowerCase().includes('untracked')
      )
      .map(entity => {
        let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
        // Always remove these strings:
        friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                   .replace(/ (Power|Energy)$/gi, '')
                                   .trim();
        if (!friendlyName.trim()) {
          friendlyName = entity.entity_id;
        }
        this.debugLog(`Room processed: ${friendlyName}`);
        return {
          entity_id: entity.entity_id,
          friendly_name: friendlyName
        };
      })
      .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
    this.debugLog(`Rooms updated: ${this.rooms.length} found.`);
    this.requestUpdate();
  }

  // Returns a parsed number or null.
  getUntrackedEntityValue(entityId) {
    let val = null;
    if (entityId.endsWith('_power')) {
      val = this.hass.states[entityId.replace(/_power$/, '_untracked_power')]?.state;
    } else if (entityId.endsWith('_energy')) {
      val = this.hass.states[entityId.replace(/_energy$/, '_untracked_energy')]?.state;
    }
    if (val !== null && !isNaN(parseFloat(val))) {
      return parseFloat(val);
    }
    return null;
  }

  // Build a flat tree structure from the selected room.
  // Level 0 (the selected room) is left untouched.
  // For children (level ≥ 1): if the friendly name starts with the main room's name plus a space,
  // remove that prefix. Then, for each substring specified in remove_strings,
  // if the friendly name starts with that substring followed by a space and extra text,
  // remove it.
  _createTreeView(entityId, level = 0, baseName = null) {
    const entityState = this.hass.states[entityId];
    if (!entityState || !entityState.attributes.selected_entities) {
      this.debugLog(`No selected entities for ${entityId}`);
      return [];
    }
    let originalFriendlyName = entityState.attributes.friendly_name || entityId;
    // Always remove these common strings:
    let friendlyName = originalFriendlyName.replace(/ selected entities -/gi, '')
                                            .replace(/ (Power|Energy)$/gi, '')
                                            .trim();
    if (level === 0) {
      // For the main room, keep its name as-is and use it as base.
      baseName = friendlyName;
    } else {
      // For children, if name starts with baseName plus a space and is longer, remove it.
      if (baseName && friendlyName.toLowerCase().startsWith(baseName.toLowerCase() + " ") && friendlyName.length > baseName.length) {
        friendlyName = friendlyName.substring(baseName.length).trim();
      }
    }
    // Now, apply additional removals from remove_strings.
    if (this.config.remove_strings) {
      const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(s => s);
      substrings.forEach(sub => {
        // Only remove if the name starts with the substring followed by a space and extra text.
        if (friendlyName.toLowerCase().startsWith(sub.toLowerCase() + " ") && friendlyName.length > sub.length) {
          friendlyName = friendlyName.substring(sub.length).trim();
        }
      });
    }
    const normalValue = parseFloat(entityState.state) || 0;
    let combinedValue = normalValue;
    const entityUnit = entityState.attributes.unit_of_measurement || '';
    const untrackedValue = this.getUntrackedEntityValue(entityId);
    if (untrackedValue !== null && !isNaN(untrackedValue)) {
      combinedValue += untrackedValue;
    }
    const baseValue = this.config.combine_value_untracked ? combinedValue : normalValue;
    const percentage = (untrackedValue > 0 && baseValue > 0)
      ? Math.round((untrackedValue / baseValue) * 100)
      : 0;
    let treeStructure = [{
      entity_id: entityId,
      friendly_name: friendlyName,
      value: normalValue,
      unit: entityUnit,
      level: level,
      percentage: percentage,
      untrackedValue: untrackedValue
    }];
    if (!this.config.show_children) {
      return treeStructure;
    }
    entityState.attributes.selected_entities.forEach(childEntityId => {
      if (childEntityId.startsWith('sensor.energy_power_monitor_')) {
        const childTree = this._createTreeView(childEntityId, level + 1, baseName);
        treeStructure = treeStructure.concat(childTree);
      } else {
        const childState = this.hass.states[childEntityId];
        if (!childState) return;
        let childFriendlyName = (childState.attributes.friendly_name || childEntityId)
                                  .replace(/ selected entities -/gi, '')
                                  .replace(/ (Power|Energy)$/gi, '')
                                  .trim();
        if (baseName && childFriendlyName.toLowerCase().startsWith(baseName.toLowerCase() + " ") && childFriendlyName.length > baseName.length) {
          childFriendlyName = childFriendlyName.substring(baseName.length).trim();
        }
        if (this.config.remove_strings) {
          const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(s => s);
          substrings.forEach(sub => {
            if (childFriendlyName.toLowerCase().startsWith(sub.toLowerCase() + " ") && childFriendlyName.length > sub.length) {
              childFriendlyName = childFriendlyName.substring(sub.length).trim();
            }
          });
        }
        if (!childFriendlyName.trim()) {
          childFriendlyName = childEntityId;
        }
        const childValue = parseFloat(childState.state) || 0;
        const childUnit = childState.attributes.unit_of_measurement || '';
        const childUntrackedValue = this.getUntrackedEntityValue(childEntityId);
        const childPercentage = (childUntrackedValue > 0 && childValue > 0)
          ? Math.round((childUntrackedValue / childValue) * 100)
          : 0;
        treeStructure.push({
          entity_id: childEntityId,
          friendly_name: childFriendlyName,
          value: childValue,
          unit: childUnit,
          level: level + 1,
          percentage: childPercentage,
          untrackedValue: childUntrackedValue
        });
        this.debugLog(`Added child: ${childFriendlyName} at level ${level + 1}`);
      }
    });
    return treeStructure;
  }

  splitAtNearestSpace(text, maxLineLength = 15) {
    this.debugLog(`Splitting text: ${text}`);
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
      if ((currentLine + word).length > maxLineLength) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine.length) {
      lines.push(currentLine.trim());
    }
    return lines;
  }

  _getBorderColor(percentage, untrackedValue) {
    const trackedColor = this.config.tracked_color || "#3CB371";
    const untrackedColor = this.config.untracked_color || "#808080";
    if (untrackedValue === null || isNaN(untrackedValue) || !this.config.show_untracked_values) {
      return `conic-gradient(from 0deg, ${trackedColor}, ${trackedColor}) border-box`;
    }
    if (percentage > 0 && this.config.show_untracked_values) {
      return `conic-gradient(from 0deg, ${untrackedColor} 0% ${percentage}%, ${trackedColor} ${percentage}% 100%) border-box`;
    }
    return `conic-gradient(from 0deg, ${trackedColor}, ${trackedColor}) border-box`;
  }

  _setCircleBackgrounds(treeStructure) {
    const circles = this.renderRoot.querySelectorAll('.circle');
    circles.forEach(circle => {
      const entityId = circle.getAttribute('data-entity-id');
      const item = treeStructure.find(item => item.entity_id === entityId);
      if (item) {
        const background = this._getBorderColor(item.percentage, item.untrackedValue);
        circle.style.setProperty('--circle-background', background);
      }
    });
  }
      
  _renderTreeView(treeStructure) {
    // Use 60px per level for indentation.
    const renderItems = (items) => {
      return items.map(item => {
        const marginLeft = item.level * 60;
        const roomState = this.hass.states[item.entity_id];
        const showIcon = this.config.show_icon && roomState && roomState.attributes.icon;
        const normalDisplay = item.value !== null ? `${item.value} ${item.unit}` : '';
        const untrackedDisplay = this.config.show_untracked_values && item.untrackedValue !== null
          ? `U: ${item.untrackedValue} ${item.unit}`
          : '';
        const friendlyNameDisplayInside = this.splitAtNearestSpace(item.friendly_name).map(line => html`<div class="friendly-name-line">${line}</div>`);
        if (this.config.room_name_position === 'below' && this.config.show_name) {
          return html`
            <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}">
              <div class="circle-wrapper">
                <div class="circle" data-entity-id="${item.entity_id}">
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
            <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}">
              <div class="circle" data-entity-id="${item.entity_id}">
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
    };
    return renderItems(treeStructure);
  }

  _getStyleVariables() {
    return `
      --tracked-value-size: ${this.config.tracked_value_size};
      --untracked-value-size: ${this.config.untracked_value_size};
      --room-name-size: ${this.config.room_name_size};
      --icon-size: ${this.config.icon_size};
      --circle-size: ${this.config.circle_size};
      --circle-tracked-color: ${this.config.tracked_color};
      --circle-untracked-color: ${this.config.untracked_color};
      --untracked-label-color: ${this.config.color_untracked_label ? this.config.untracked_color : 'grey'};
    `;
  }

  _handleEntityClick(entityId) {
    if (this.isClickHandling) return;
    this.isClickHandling = true;
    const event = new Event('hass-more-info', {
      composed: true,
    });
    event.detail = { entityId: entityId };
    this.dispatchEvent(event);
    setTimeout(() => {
      this.isClickHandling = false;
    }, 100);
  }
  isClickHandling = false;

  render() {
    const selectedRoom = this.config.room;
    const roomState = selectedRoom ? this.hass.states[selectedRoom] : null;
    if (!roomState) {
      return html`<ha-card><div>No room selected.</div></ha-card>`;
    }
    const treeStructure = this._createTreeView(selectedRoom);
    this._setCircleBackgrounds(treeStructure);
    return html`
      <ha-card style="${this._getStyleVariables()}">
        <div class="container">
          <div class="tree-view">
            ${this._renderTreeView(treeStructure)}
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
      :host {
        display: block;
      }
      .container {
        padding: 16px;
        text-align: center;
      }
      .circle-wrapper {
        display: inline-block;
        text-align: center;
      }
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
        border: 4px solid transparent;
        background: var(--circle-background, var(--circle-tracked-color, #3CB371));
        -webkit-mask: 
          linear-gradient(#fff 0 0) padding-box, 
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
                mask-composite: exclude;
        z-index: 0;
      }
      .circle-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100%;
        width: 100%;
        padding: 10px;
        white-space: normal;
        box-sizing: border-box;
      }
      .tree-item {
        position: relative;
        margin-bottom: 4px;
      }
      /* Vertical line for hierarchy (for items with data-level > 0) */
      .tree-item[data-level]:not([data-level="0"])::before {
        content: "";
        position: absolute;
        left: -15px;
        top: 0;
        bottom: 0;
        border-left: 2px solid var(--divider-color, #e0e0e0);
      }
      .friendly-name-line {
        margin: 0;
        line-height: 1.4;
      }
      .room-name {
        margin: 0;
        font-size: var(--room-name-size, 10.5px);
        margin-top: 4px;
        white-space: nowrap;
      }
      .icon {
        font-size: var(--icon-size, 22px);
        margin-bottom: 3.5px;
      }
      .tree-view {
        margin-top: 10px;
        text-align: left;
      }
      .entity-value {
        text-align: center;
        font-size: var(--tracked-value-size, 10.5px);
        line-height: 1.1;
        color: white;
      }
      .untracked-value {
        text-align: center;
        font-size: var(--untracked-value-size, 10.5px);
        line-height: 1.1;
        margin-top: 2px;
        color: var(--untracked-label-color, grey);
      }
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
    this._config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      show_children: config.show_children !== false,
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "below",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
      // New option: default false
      color_untracked_label: config.color_untracked_label === true,
      // New option: remove_strings (semicolon-separated), default empty string
      remove_strings: config.remove_strings !== undefined ? config.remove_strings : "",
      room: config.room,
      ...config,
    };
    this.rooms = [];
    this._fetchRooms();
  }

  async _fetchRooms() {
    const entities = await this.hass.callWS({
      type: 'config/entity_registry/list'
    });
    this.rooms = entities
      .filter(entity =>
        entity.entity_id.startsWith('sensor.energy_power_monitor_') &&
        !(this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id)
          .toLowerCase().includes('untracked')
      )
      .map(entity => {
        let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
        friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                   .replace(/ (Power|Energy)$/gi, '')
                                   .trim();
        if (!friendlyName.trim()) {
          friendlyName = entity.entity_id;
        }
        return {
          entity_id: entity.entity_id,
          friendly_name: friendlyName
        };
      })
      .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
    if (!this._config.room && this.rooms.length > 0) {
      this._config.room = this.rooms[0].entity_id;
      this.fireConfigChanged();
    }
    this.requestUpdate();
  }

  _roomChanged(ev) {
    const selectedRoom = ev.target.value;
    this._config = { ...this._config, room: selectedRoom };
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
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    // Options for font sizes (8px to 20px in 0.5px steps)
    const fontSizeOptions = [];
    for (let i = 8; i <= 20; i += 0.5) {
      fontSizeOptions.push(i.toFixed(1) + "px");
    }
    // Options for circle size (50px to 200px in 5px steps)
    const circleSizeOptions = [];
    for (let i = 50; i <= 200; i += 5) {
      circleSizeOptions.push(i + "px");
    }
    // Options for icon size (12px to 50px in 1px steps)
    const iconSizeOptions = [];
    for (let i = 12; i <= 50; i += 1) {
      iconSizeOptions.push(i + "px");
    }
    const selectedRoom = this._config.room || "";
    return html`
      <style>
        .option-group {
          margin-bottom: 16px;
          border: 1px solid var(--divider-color, #e0e0e0);
          padding: 8px;
          border-radius: 4px;
        }
        .option-group h3 {
          margin: 0 0 8px 0;
          font-size: 14px;
        }
        .option {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .option label {
          flex: 0 0 220px;
          font-size: 12px;
        }
        .option input[type="checkbox"],
        .option input[type="color"],
        .option input[type="text"],
        .option select {
          flex: 1;
        }
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
          <label for="show_children">Show Children:</label>
          <input type="checkbox" id="show_children" name="show_children" .checked="${this._config.show_children !== false}" @change="${this._toggleOption}">
        </div>
      </div>
      <div class="option-group">
        <h3>Style Options</h3>
        <div class="option">
          <label for="tracked_color">Tracked Color:</label>
          <input type="color" id="tracked_color" name="tracked_color" value="${this._config.tracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="untracked_color">Untracked Color:</label>
          <input type="color" id="untracked_color" name="untracked_color" value="${this._config.untracked_color}" @change="${this._toggleOption}">
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
          <label for="remove_strings" title="Enter substrings (e.g., '1 OG; Living') to remove from the beginning of the name if present and followed by a space">Remove strings from name (separated by ;):</label>
          <input type="text" id="remove_strings" name="remove_strings" .value="${this._config.remove_strings}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="tracked_value_size">Tracked Value Size:</label>
          <select id="tracked_value_size" name="tracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`
              <option value="${size}" ?selected="${this._config.tracked_value_size === size}">${size}</option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="untracked_value_size">Untracked Value Size:</label>
          <select id="untracked_value_size" name="untracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`
              <option value="${size}" ?selected="${this._config.untracked_value_size === size}">${size}</option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="room_name_size">Room Name Size:</label>
          <select id="room_name_size" name="room_name_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`
              <option value="${size}" ?selected="${this._config.room_name_size === size}">${size}</option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="icon_size">Icon Size:</label>
          <select id="icon_size" name="icon_size" @change="${this._toggleOption}">
            ${iconSizeOptions.map(size => html`
              <option value="${size}" ?selected="${this._config.icon_size === size}">${size}</option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="circle_size">Circle Size:</label>
          <select id="circle_size" name="circle_size" @change="${this._toggleOption}">
            ${circleSizeOptions.map(size => html`
              <option value="${size}" ?selected="${this._config.circle_size === size}">${size}</option>
            `)}
          </select>
        </div>
      </div>
    `;
  }
}

customElements.define("energy-power-monitor-card-editor", EnergyandPowerMonitorCardEditor);
