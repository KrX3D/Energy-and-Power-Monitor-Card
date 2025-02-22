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

  debugEnabled = false; // Set to false to disable logging

  debugLog(message) {
    if (this.debugEnabled) {
      console.log(message);
    }
  }

  setConfig(config) {
    this.debugLog('Setting config...');
    this.config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      clean_subelement_names: config.clean_subelement_names !== false,
      show_children: config.show_children !== false,
      // Style defaults:
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "inside", // "inside" or "below"
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
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
        friendlyName = friendlyName.replace(/ selected entities -/gi, '');
        friendlyName = friendlyName.replace(/ (Power|Energy)$/i, '');
        // Fallback if cleaning empties the name:
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

  _createTreeView(entityId, level = 0, parentFriendlyNameToRemove = '') {
    this.debugLog(`Creating tree view for entity: ${entityId} at level ${level}`);
    const entityState = this.hass.states[entityId];
    if (!entityState || !entityState.attributes.selected_entities) {
      this.debugLog(`No selected entities found for ${entityId}`);
      return [];
    }

    const selectedEntities = entityState.attributes.selected_entities.filter(entity =>
      !entity.endsWith('_untracked_power') && !entity.endsWith('_untracked_energy')
    );

    let friendlyName = entityState.attributes.friendly_name || entityId;
    friendlyName = friendlyName.replace(/\s?(\b(selected entities - )?(power|leistung|energy|energie)\b)\s*$/i, '');
    if (!friendlyName.trim()) {
      friendlyName = entityId;
    }

    const cleanSubelementNames = this.config.clean_subelement_names !== false;
    if (cleanSubelementNames) {
      if (level === 1) {
        parentFriendlyNameToRemove = friendlyName + ' ';
      } else if (level > 1) {
        if (parentFriendlyNameToRemove && friendlyName.startsWith(parentFriendlyNameToRemove)) {
          friendlyName = friendlyName.replace(new RegExp(`^${parentFriendlyNameToRemove}`), '');
          this.debugLog(`Cleaned friendly name for level ${level}: ${friendlyName}`);
        }
      }
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

    // Process child entities (only if show_children is true)
    selectedEntities.forEach(childEntityId => {
      if (childEntityId.startsWith('sensor.energy_power_monitor_')) {
        const childTreeStructure = this._createTreeView(
          childEntityId,
          level + 1,
          cleanSubelementNames ? (level === 0 ? friendlyName + ' ' : parentFriendlyNameToRemove) : ''
        );
        treeStructure = treeStructure.concat(childTreeStructure);
      } else {
        if (this.config.show_children) {
          const childEntityState = this.hass.states[childEntityId];
          if (!childEntityState) return;
          let childFriendlyName = childEntityState.attributes.friendly_name || childEntityId;
          childFriendlyName = childFriendlyName.replace(/\s?(\b(selected entities - )?(power|leistung|energy|energie)\b)\s*$/i, '');
          if (!childFriendlyName.trim()) {
            childFriendlyName = childEntityId;
          }
          const childEntityValue = parseFloat(childEntityState.state) || 0;
          const childEntityUnit = childEntityState.attributes.unit_of_measurement || '';
          const childUntrackedValue = this.getUntrackedEntityValue(childEntityId);
          const percentage = childUntrackedValue > 0 && childEntityValue > 0 
            ? Math.round((childUntrackedValue / childEntityValue) * 100)
            : 0;
          treeStructure.push({
            entity_id: childEntityId,
            friendly_name: childFriendlyName,
            value: childEntityValue,
            unit: childEntityUnit,
            level: level + 1,
            percentage: percentage,
            untrackedValue: childUntrackedValue
          });
        }
      }
    });
    return treeStructure;
  }

  splitAtNearestSpace(text, maxLineLength = 15) {
    this.debugLog(`Splitting text into lines: ${text}`);
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach((word) => {
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

    this.debugLog(`Split text into lines: ${JSON.stringify(lines)}`);
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
    this.debugLog(`_setCircleBackgrounds function called`);
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
    this.debugLog('Rendering tree view...');
    const renderedEntities = new Set();

    const renderItems = (items, level = 0) => {
      return items.map(item => {
        if (renderedEntities.has(item.entity_id)) {
          return '';
        }
        renderedEntities.add(item.entity_id);

        const roomState = this.hass.states[item.entity_id];
        const showIcon = this.config.show_icon && roomState && roomState.attributes.icon; 

        // Use the value and unit computed in the treeStructure
        const normalDisplay = item.value !== null ? `${item.value} ${item.unit}` : '';
        const untrackedDisplay = this.config.show_untracked_values && item.untrackedValue !== null
          ? `U: ${item.untrackedValue} ${item.unit}`
          : '';
        const friendlyName = item.friendly_name || item.entity_id;
        const friendlyNameDisplayInside = this.splitAtNearestSpace(friendlyName).map(line => html`<div class="friendly-name-line">${line}</div>`);

        // Get children from the current entity’s state (if available)
        const childEntities = (roomState && roomState.attributes.selected_entities 
          ? roomState.attributes.selected_entities.filter(childEntityId => 
              !childEntityId.endsWith('_untracked_power') && 
              !childEntityId.endsWith('_untracked_energy')
            )
          : []);
        // Only render children if show_children is true
        const hasChildren = childEntities.length > 0 && this.config.show_children;
        
        return html`
          <div class="tree-item" style="padding-left: ${level * 20}px;" @click="${() => this._handleEntityClick(item.entity_id)}">
            ${this.config.room_name_position === 'below' && this.config.show_name ? html`
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
                <div class="room-name">${friendlyName}</div>
              </div>
            ` : html`
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
            `}
            ${hasChildren ? html`
              <div class="children">
                ${renderItems(
                  childEntities.map(childEntityId => {
                    const childItem = treeStructure.find(child => child.entity_id === childEntityId);
                    return childItem;
                  }).filter(item => item !== undefined),
                  level + 1
                )}
              </div>
            ` : ''}
          </div>
        `;
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
      .tree-item {
        cursor: pointer;
        margin: 4px 0;
      }
      .children {
        margin-left: 20px;
        border-left: 2px solid var(--divider-color);
        padding-left: 10px;
      }
      .entity-value {
        flex: 0 1 auto;
        text-align: center;
        font-size: var(--tracked-value-size, 10.5px);
        line-height: 1.1;
        color: white;
        margin-bottom: 3px;
      }
      .untracked-value {
        flex: 0 1 auto;
        text-align: center;
        font-size: var(--untracked-value-size, 10.5px);
        line-height: 1.1;
        color: grey;
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
      clean_subelement_names: config.clean_subelement_names !== false,
      show_children: config.show_children !== false,
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "inside",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
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
        friendlyName = friendlyName.replace(/ selected entities -/gi, '').replace(/ (Power|Energy)$/i, '');
        if (!friendlyName.trim()) {
          friendlyName = entity.entity_id;
        }
        return {
          entity_id: entity.entity_id,
          friendly_name: friendlyName
        };
      })
      .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));

    // If no room is set, default to the first available room.
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
    let value;
    if (ev.target.type === 'checkbox') {
      value = ev.target.checked;
    } else {
      value = ev.target.value;
    }
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
    // Dropdown options for font sizes (8px to 20px in 0.5px steps)
    const fontSizeOptions = [];
    for (let i = 8; i <= 20; i += 0.5) {
      fontSizeOptions.push(i.toFixed(1) + "px");
    }
    // Dropdown options for circle size (50px to 200px in 5px steps)
    const circleSizeOptions = [];
    for (let i = 50; i <= 200; i += 5) {
      circleSizeOptions.push(i + "px");
    }
    // Dropdown options for icon size (12px to 50px in 1px steps)
    const iconSizeOptions = [];
    for (let i = 12; i <= 50; i += 1) {
      iconSizeOptions.push(i + "px");
    }
    
    const selectedRoom = this._config.room || "";
    return html`
      <div>
        <label for="room">Select Room:</label>
        <select id="room" @change="${this._roomChanged}">
          ${this.rooms.map(room => html`
            <option value="${room.entity_id}" ?selected="${room.entity_id === selectedRoom}">
              ${room.friendly_name}
            </option>
          `)}
        </select>
      </div>
      <div>
        <label for="show_name">Show Name:</label>
        <input type="checkbox" id="show_name" name="show_name" .checked="${this._config.show_name !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="show_icon">Show Icon:</label>
        <input type="checkbox" id="show_icon" name="show_icon" .checked="${this._config.show_icon !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="show_untracked_values">Show Untracked Values:</label>
        <input type="checkbox" id="show_untracked_values" name="show_untracked_values" .checked="${this._config.show_untracked_values !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="combine_value_untracked">Combine Untracked Values:</label>
        <input type="checkbox" id="combine_value_untracked" name="combine_value_untracked" .checked="${this._config.combine_value_untracked !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="clean_subelement_names">Clean Subelement Names:</label>
        <input type="checkbox" id="clean_subelement_names" name="clean_subelement_names" .checked="${this._config.clean_subelement_names !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="show_children">Show Children:</label>
        <input type="checkbox" id="show_children" name="show_children" .checked="${this._config.show_children !== false}" @change="${this._toggleOption}">
      </div>
      <!-- Style Options -->
      <div>
        <label for="tracked_color">Tracked Color:</label>
        <input type="color" id="tracked_color" name="tracked_color" value="${this._config.tracked_color}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="untracked_color">Untracked Color:</label>
        <input type="color" id="untracked_color" name="untracked_color" value="${this._config.untracked_color}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="room_name_position">Room Name Position:</label>
        <select id="room_name_position" name="room_name_position" @change="${this._toggleOption}">
          <option value="inside" ?selected="${this._config.room_name_position === 'inside' || !this._config.room_name_position}">Inside</option>
          <option value="below" ?selected="${this._config.room_name_position === 'below'}">Below</option>
        </select>
      </div>
      <div>
        <label for="tracked_value_size">Tracked Value Size:</label>
        <select id="tracked_value_size" name="tracked_value_size" @change="${this._toggleOption}">
          ${fontSizeOptions.map(size => html`
            <option value="${size}" ?selected="${this._config.tracked_value_size === size}">${size}</option>
          `)}
        </select>
      </div>
      <div>
        <label for="untracked_value_size">Untracked Value Size:</label>
        <select id="untracked_value_size" name="untracked_value_size" @change="${this._toggleOption}">
          ${fontSizeOptions.map(size => html`
            <option value="${size}" ?selected="${this._config.untracked_value_size === size}">${size}</option>
          `)}
        </select>
      </div>
      <div>
        <label for="room_name_size">Room Name Size:</label>
        <select id="room_name_size" name="room_name_size" @change="${this._toggleOption}">
          ${fontSizeOptions.map(size => html`
            <option value="${size}" ?selected="${this._config.room_name_size === size}">${size}</option>
          `)}
        </select>
      </div>
      <div>
        <label for="icon_size">Icon Size:</label>
        <select id="icon_size" name="icon_size" @change="${this._toggleOption}">
          ${iconSizeOptions.map(size => html`
            <option value="${size}" ?selected="${this._config.icon_size === size}">${size}</option>
          `)}
        </select>
      </div>
      <div>
        <label for="circle_size">Circle Size:</label>
        <select id="circle_size" name="circle_size" @change="${this._toggleOption}">
          ${circleSizeOptions.map(size => html`
            <option value="${size}" ?selected="${this._config.circle_size === size}">${size}</option>
          `)}
        </select>
      </div>
    `;
  }
}

customElements.define("energy-power-monitor-card-editor", EnergyandPowerMonitorCardEditor);
