/**
 * puckAdapter.js
 *
 * Provides bidirectional conversion between the backend FastAPI ScorecardDocument
 * schema (recursive ScorecardNode tree: { id, type, props, children }) and
 * Puck's data format ({ root, content, zones }).
 */

export function generateId(prefix = 'node') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function normalizeAdditionalInfoItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { key: '', value: String(item ?? '') };
    }
    if (item.key != null || item.name != null || item.label != null) {
      return {
        key: String(item.key || item.name || item.label || ''),
        value: item.value ?? item.val ?? '',
      };
    }
    const entries = Object.entries(item).filter(([field]) => field !== 'id');
    if (!entries.length) return { key: '', value: '' };
    const [key, value] = entries[0];
    return { key, value: value ?? '' };
  });
}

/**
 * Converts a backend ScorecardDocument into Puck's Data format.
 */
export function treeToPuckData(document) {
  if (!document || !document.root) {
    return {
      rootId: 'root',
      puckData: {
        root: { props: { title: document?.title || 'Risk Scorecard' } },
        content: [],
        zones: {},
      },
    };
  }

  const rootNode = document.root;
  const zones = {};

  function convertNode(node) {
    if (!node) return null;
    const isContainer = node.type === 'Grid' || node.type === 'Flex';
    const id = node.id || generateId(node.type?.toLowerCase() || 'item');
    const rawProps = { ...(node.props || {}) };

    if (node.type === 'AdditionalInfo') {
      rawProps.items = normalizeAdditionalInfoItems(rawProps.items);
    }

    // Normalize KpiCard and Card scale array -> scaleMin / scaleMax for friendlier Puck fields
    if ((node.type === 'KpiCard' || node.type === 'Card') && Array.isArray(rawProps.scale)) {
      rawProps.scaleMin = rawProps.scale[0] ?? 0;
      rawProps.scaleMax = rawProps.scale[1] ?? (node.type === 'Card' ? 5 : 100);
    }

    const puckItem = {
      type: node.type,
      props: {
        id,
        ...rawProps,
      },
    };

    if (isContainer && Array.isArray(node.children)) {
      zones[`${id}:children`] = node.children.map(convertNode).filter(Boolean);
    }

    return puckItem;
  }

  const isTopContainer = rootNode.type === 'Grid' || rootNode.type === 'Flex';
  let content = [];
  const layoutSize = document.layout_size || document.layout || rootNode.props?.layout_size || rootNode.props?.layout || 'a4';
  const rootProps = {
    title: document.title || 'Risk Scorecard',
    layout_size: layoutSize,
    layout: rootNode.type === 'Grid' ? `grid-${rootNode.props?.columns || 1}` : 'flex',
    gap: rootNode.props?.gap ?? 14,
    language: document.language || 'en',
  };

  if (isTopContainer && Array.isArray(rootNode.children)) {
    content = rootNode.children.map(convertNode).filter(Boolean);
  } else {
    const single = convertNode(rootNode);
    if (single) content = [single];
  }

  return {
    rootId: rootNode.id || 'root',
    puckData: {
      root: { props: rootProps },
      content,
      zones,
    },
  };
}

/**
 * Converts Puck's Data format back into a backend ScorecardDocument tree.
 */
export function puckDataToTree(puckData, rootId = 'root', defaultTitle = 'Risk Scorecard') {
  if (!puckData) {
    return {
      title: defaultTitle,
      root: {
        id: rootId,
        type: 'Flex',
        props: { direction: 'column', gap: 14 },
        children: [],
      },
    };
  }

  const rootProps = puckData.root?.props || {};
  const isGrid = (rootProps.layout || '').startsWith('grid');
  const columns = rootProps.layout === 'grid-3' ? 3 : rootProps.layout === 'grid-2' ? 2 : 1;
  const gap = Number(rootProps.gap ?? 14);
  const zones = puckData.zones || {};

  function convertItem(item) {
    if (!item || !item.type) return null;
    const isContainer = item.type === 'Grid' || item.type === 'Flex';
    const id = item.props?.id || generateId(item.type.toLowerCase());
    const cleanProps = { ...(item.props || {}) };
    delete cleanProps.id;
    delete cleanProps.children;

    // Convert scaleMin/scaleMax back into [min, max] array for KpiCard and Card backend schema
    if (item.type === 'KpiCard' || item.type === 'Card') {
      const min = Number(cleanProps.scaleMin ?? cleanProps.scale?.[0] ?? 0);
      const max = Number(cleanProps.scaleMax ?? cleanProps.scale?.[1] ?? (item.type === 'Card' ? 5 : 100));
      cleanProps.scale = [min, max];
      delete cleanProps.scaleMin;
      delete cleanProps.scaleMax;

      if (item.type === 'KpiCard') {
        cleanProps.value = Number(cleanProps.value) || 0;
      } else if (cleanProps.value !== null && cleanProps.value !== undefined && cleanProps.value !== '') {
        cleanProps.value = Number(cleanProps.value);
      } else {
        cleanProps.value = null;
      }
    }

    if (item.type === 'Map') {
      if (!Array.isArray(cleanProps.bbox) || cleanProps.bbox.length < 4) {
        cleanProps.bbox = [80.0, 26.0, 88.0, 30.0];
      } else {
        cleanProps.bbox = cleanProps.bbox.map(Number);
      }
      cleanProps.height = Number(cleanProps.height) || 190;
    }

    if (item.type === 'AdditionalInfo') {
      cleanProps.items = normalizeAdditionalInfoItems(cleanProps.items);
    }

    let children = null;
    if (isContainer) {
      const zoneItems = zones[`${id}:children`] || [];
      children = zoneItems.map(convertItem).filter(Boolean);
    }

    return {
      id,
      type: item.type,
      props: cleanProps,
      children,
    };
  }

  const rootChildren = (puckData.content || []).map(convertItem).filter(Boolean);
  const layoutSize = rootProps.layout_size || 'a4';

  return {
    title: rootProps.title || defaultTitle,
    layout_size: layoutSize,
    layout: layoutSize,
    language: rootProps.language || 'en',
    root: {
      id: rootId,
      type: isGrid ? 'Grid' : 'Flex',
      props: isGrid
        ? { columns, gap, layout_size: layoutSize, layout: layoutSize }
        : { direction: 'column', gap, wrap: false, align: 'stretch', justify: 'flex-start', layout_size: layoutSize, layout: layoutSize },
      children: rootChildren,
    },
  };
}

/**
 * Helper to update dynamic risk scores across items in Puck data
 * when the numeric indicators form updates.
 */
export function updatePuckDataScores(puckData, indicators, overallScore) {
  if (!puckData) return puckData;
  const indicatorByName = new Map(indicators.map((ind) => [ind.name, Number(ind.score) || 0]));
  const indicatorRows = new Map(indicators.map((ind) => [ind.name, ind]));

  function updateItem(item) {
    if (!item) return item;
    let props = { ...item.props };

    if (item.type === 'KpiCard') {
      const isOverall = !indicatorByName.has(props.label);
      if (isOverall) {
        props.value = Number(overallScore) || 0;
        props.scaleMin = 0;
        props.scaleMax = 100;
        props.scale = [0, 100];
      } else if (indicatorByName.has(props.label)) {
        const ind = indicatorRows.get(props.label);
        props.value = Number(ind.score) || 0;
        props.scaleMin = Number(ind.scaleMin ?? 0);
        props.scaleMax = Number(ind.scaleMax ?? 100);
        props.scale = [props.scaleMin, props.scaleMax];
      }
    } else if (item.type === 'Chart' && Array.isArray(props.data)) {
      props.data = props.data.map((row) =>
        indicatorByName.has(row.name || row.indicator)
          ? { ...row, score: indicatorByName.get(row.name || row.indicator) }
          : row
      );
    } else if (item.type === 'Table' && Array.isArray(props.rows)) {
      props.rows = props.rows.map((row) => {
        const ind = indicatorRows.get(row[0]);
        if (!ind) return row;
        return row.map((cell, idx) =>
          idx === 1 || idx === 3 ? ind.score : idx === 2 ? `${ind.scaleMin ?? 0} – ${ind.scaleMax ?? 100}` : cell
        );
      });
    }

    return {
      ...item,
      props,
    };
  }

  const updatedContent = (puckData.content || []).map(updateItem);
  const updatedZones = {};
  if (puckData.zones) {
    for (const [key, list] of Object.entries(puckData.zones)) {
      updatedZones[key] = (list || []).map(updateItem);
    }
  }

  return {
    ...puckData,
    content: updatedContent,
    zones: updatedZones,
  };
}
