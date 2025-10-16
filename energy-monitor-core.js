/**
 * Core Energy Monitor Logic - energy-monitor-core.js
 * Business logic separated from any UI framework
 */

export class EnergyMonitorLogic {
  constructor(config = {}) {
    this.config = this._initConfig(config);
    this.debugEnabled = false;
  }

  _initConfig(config) {
    return {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      levels_to_show: config.levels_to_show || "all",
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "below",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
      circle_size_unit: config.circle_size_unit || "px",
      color_untracked_label: config.color_untracked_label === true,
      remove_strings: config.remove_strings !== undefined ? config.remove_strings : "",
      room: config.room,
      ring_width: config.ring_width !== undefined ? config.ring_width : '6px',
      decimal_precision: (config.decimal_precision !== undefined) ? parseInt(config.decimal_precision) : 1,
      ...config,
    };
  }

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EnergyMonitorCore]', msg);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  _isUntrackedEntityId(entityId) {
    if (!entityId) return false;
    return /_untracked(_power|_energy)?$/i.test(entityId) || entityId.toLowerCase().includes('_untracked');
  }

  getUntrackedEntityValue(entityId, states) {
    try {
      let val = null;
      if (entityId.endsWith('_power')) {
        val = states[entityId.replace(/_power$/, '_untracked_power')]?.state;
      } else if (entityId.endsWith('_energy')) {
        val = states[entityId.replace(/_energy$/, '_untracked_energy')]?.state;
      }
      if (val === undefined || val === null) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    } catch (e) {
      return null;
    }
  }

  createTreeView(entityId, states, level = 0, baseName = null, visited = new Set()) {
    if (this._isUntrackedEntityId(entityId)) {
      this.debugLog(`Skipping untracked entity ${entityId}`);
      return [];
    }

    if (visited.has(entityId)) {
      this.debugLog(`Skipping already visited ${entityId}`);
      return [];
    }
    visited.add(entityId);

    const entityState = states[entityId];
    if (!entityState) {
      this.debugLog(`Entity state missing for ${entityId}`);
      return [];
    }

    const selEntities = Array.isArray(entityState.attributes.selected_entities)
      ? entityState.attributes.selected_entities
      : (typeof entityState.attributes.selected_entities === 'string'
          ? [entityState.attributes.selected_entities]
          : []);

    let originalFriendlyName = entityState.attributes.friendly_name || entityId;
    let friendlyName = this._cleanFriendlyName(originalFriendlyName, baseName, level);

    if (level === 0) {
      baseName = friendlyName;
    }

    const normalValue = parseFloat(entityState.state) || 0;
    const entityUnit = entityState.attributes.unit_of_measurement || '';
    const untrackedValue = this.getUntrackedEntityValue(entityId, states);
    const displayValue = this.config.combine_value_untracked ? (normalValue + (untrackedValue || 0)) : normalValue;
    const total = normalValue + (untrackedValue || 0);
    const percentage = total > 0 ? Math.round((untrackedValue || 0) / total * 100) : 0;

    let tree = [{
      entity_id: entityId,
      friendly_name: friendlyName,
      value: displayValue,
      unit: entityUnit,
      level: level,
      percentage: percentage,
      untrackedValue: untrackedValue,
      icon: entityState.attributes.icon || null,
      state: entityState.state,
    }];

    selEntities.forEach(childEntityId => {
      try {
        if (!childEntityId) return;
        if (this._isUntrackedEntityId(childEntityId)) {
          this.debugLog(`Skipping child untracked entity ${childEntityId}`);
          return;
        }

        if (childEntityId.startsWith('sensor.energy_power_monitor_')) {
          const childTree = this.createTreeView(childEntityId, states, level + 1, baseName, visited);
          tree = tree.concat(childTree);
        } else {
          const childState = states[childEntityId];
          if (!childState) return;

          let childFriendlyName = (childState.attributes.friendly_name || childEntityId)
                                    .replace(/ selected entities -/gi, '')
                                    .replace(/ (Power|Energy)$/gi, '')
                                    .trim();

          if (baseName && childFriendlyName.toLowerCase().startsWith(baseName.toLowerCase() + " ")) {
            childFriendlyName = childFriendlyName.substring(baseName.length).trim();
          }

          if (this.config.remove_strings) {
            const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(Boolean);
            for (let sub of substrings) {
              if (childFriendlyName.toLowerCase().startsWith(sub.toLowerCase() + " ")) {
                childFriendlyName = childFriendlyName.substring(sub.length).trim();
                break;
              }
            }
          }

          if (!childFriendlyName) childFriendlyName = childEntityId;

          const childValue = parseFloat(childState.state) || 0;
          const childUntracked = this.getUntrackedEntityValue(childEntityId, states);
          const childDisplayValue = this.config.combine_value_untracked ? (childValue + (childUntracked || 0)) : childValue;
          const childTotal = childValue + (childUntracked || 0);
          const childPercentage = childTotal > 0 ? Math.round((childUntracked || 0) / childTotal * 100) : 0;

          tree.push({
            entity_id: childEntityId,
            friendly_name: childFriendlyName,
            value: childDisplayValue,
            unit: childState.attributes.unit_of_measurement || '',
            level: level + 1,
            percentage: childPercentage,
            untrackedValue: childUntracked,
            icon: childState.attributes.icon || null,
            state: childState.state,
          });

          this.debugLog(`Added child ${childFriendlyName} (${childEntityId})`);
        }
      } catch (e) {
        this.debugLog('Error processing child ' + childEntityId + ': ' + e);
      }
    });

    return tree;
  }

  _cleanFriendlyName(name, baseName, level) {
    let cleaned = name.replace(/ selected entities -/gi, '')
                      .replace(/ (Power|Energy)$/gi, '')
                      .trim();

    if (baseName && level > 0 && cleaned.toLowerCase().startsWith(baseName.toLowerCase() + " ")) {
      cleaned = cleaned.substring(baseName.length).trim();
    }

    if (this.config.remove_strings && level > 0) {
      const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(Boolean);
      for (let sub of substrings) {
        if (cleaned.toLowerCase().startsWith(sub.toLowerCase() + " ")) {
          cleaned = cleaned.substring(sub.length).trim();
          break;
        }
      }
    }

    return cleaned;
  }

  filterTree(tree) {
    const option = this.config.levels_to_show || "all";
    if (option === "selected") {
      return tree.filter(node => node.level === 0);
    } else if (option === "first") {
      return tree.filter(node => node.level <= 1);
    } else if (option === "parents") {
      return tree.filter((node, idx) => {
        const curLevel = node.level;
        for (let j = idx + 1; j < tree.length; j++) {
          if (tree[j].level <= curLevel) break;
          if (tree[j].level === curLevel + 1) return true;
        }
        return false;
      });
    }
    return tree;
  }

  formatNumber(val) {
    if (val === null || val === undefined || isNaN(parseFloat(val))) return '';

    const rawPrecision = this.config.decimal_precision || 1;
    const precision = Math.max(0, Math.min(3, parseInt(rawPrecision, 10) || 1));

    try {
      const fixed = Number(val).toFixed(precision);
      const parsed = parseFloat(fixed);
      return isNaN(parsed) ? String(Number(val)) : parsed.toString();
    } catch (e) {
      const n = Number(val);
      return isNaN(n) ? '' : n.toString();
    }
  }

  formatValue(val, unit) {
    const numStr = this.formatNumber(val);
    if (!numStr) return '';
    return unit ? `${numStr} ${unit}` : numStr;
  }

  getBorderColor(percentage, untrackedValue) {
    const trackedColor = this.config.tracked_color || "#3CB371";
    const untrackedColor = this.config.untracked_color || "#808080";

    if (untrackedValue === null || isNaN(untrackedValue) || !this.config.show_untracked_values) {
      return `conic-gradient(${trackedColor} 0% 100%)`;
    }

    if (percentage > 0 && this.config.show_untracked_values) {
      return `conic-gradient(${untrackedColor} 0% ${percentage}%, ${trackedColor} ${percentage}% 100%)`;
    }

    return `conic-gradient(${trackedColor} 0% 100%)`;
  }

  getStyleVariables() {
    const trackedValSize = this.config.tracked_value_size || '10.5px';
    const untrackedValSize = this.config.untracked_value_size || '10.5px';
    const roomNameSize = this.config.room_name_size || '10.5px';
    const iconSize = this.config.icon_size || '22px';
    const circleSize = this.config.circle_size || '80px';
    const trackedColor = this.config.tracked_color || '#3CB371';
    const untrackedColor = this.config.untracked_color || '#808080';
    const untrackedLabelColor = this.config.color_untracked_label ? untrackedColor : 'grey';

    const circleSizeNum = parseFloat(circleSize) || 80;
    const ringNum = parseFloat(this.config.ring_width) || 6;
    const maxRing = Math.max(2, Math.floor(circleSizeNum / 2) - 4);
    const finalRing = Math.min(ringNum, maxRing);

    return {
      trackedValSize,
      untrackedValSize,
      roomNameSize,
      iconSize,
      circleSize,
      trackedColor,
      untrackedColor,
      untrackedLabelColor,
      ringWidth: finalRing,
    };
  }

  splitAtNearestSpace(text, maxLineLength = 15) {
    if (!text) return [];
    const words = String(text).split(' ').filter(Boolean);
    if (words.length === 0) return [];
    const lines = [];
    let current = '';

    for (let w of words) {
      if ((current + (current ? ' ' : '') + w).length > maxLineLength) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = current ? `${current} ${w}` : w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  getProcessedData(entityId, states) {
    const tree = this.createTreeView(entityId, states);
    const filtered = this.filterTree(tree);
    const styles = this.getStyleVariables();

    return {
      items: filtered,
      styles,
      config: this.config,
    };
  }
}

export default EnergyMonitorLogic;