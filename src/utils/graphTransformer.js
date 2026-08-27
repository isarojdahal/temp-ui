export function transformMCVRATreeToReactFlow(treeData) {
  if (!treeData) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  const levelGapX = 380;
  const siblingGapY = 180;

  let yCounter = 0;

  function formatFormula(formula) {
    if (!formula) return null;
    if (typeof formula === 'string') return formula;
    if (Array.isArray(formula)) {
      return formula
        .map((token) => (typeof token === 'object' ? (token.label || token.name || token.value || '') : String(token)))
        .join(' ');
    }
    return null;
  }

  function formatChoices(node) {
    if (node.choices && Array.isArray(node.choices)) return node.choices;
    if (node.data?.metricValue?.value && Array.isArray(node.data.metricValue.value)) {
      return node.data.metricValue.value.map((v) => ({
        name: v.option || v.name || v.label || '',
        score: v.value !== undefined ? v.value : v.score
      }));
    }
    return [];
  }

  function traverse(node, depth = 0, parentId = null) {
    if (!node || typeof node !== 'object') return;

    const nodeId = node.id || node.backend_id || `node-${Math.random().toString(36).substr(2, 9)}`;
    const nodeType = node.type || node.node_type || (node.children?.length ? 'criteria' : 'question');

    // First traverse children to calculate Y positioning if position isn't pre-computed
    let childYSum = 0;
    const startYCounter = yCounter;

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        traverse(child, depth + 1, nodeId);
      });
      childYSum = (startYCounter + (yCounter - siblingGapY)) / 2;
    } else {
      childYSum = yCounter;
      yCounter += siblingGapY;
    }

    // Use position pre-computed by backend if available, else calculate X, Y
    const posX = node.position?.x !== undefined ? node.position.x : (depth * levelGapX + 50);
    const posY = node.position?.y !== undefined ? node.position.y : childYSum;

    const label = node.name || node.data?.label || node.label || nodeId;
    const formulaStr = formatFormula(node.formula || node.data?.formula);
    const choicesList = formatChoices(node);

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x: posX, y: posY },
      data: {
        label: label,
        formula: formulaStr,
        choices: choicesList,
        depth: node.data?.level !== undefined ? node.data.level : depth,
        rawType: nodeType
      }
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'curved',
        animated: nodeType === 'raster_calculation',
        style: { stroke: nodeType === 'question' ? '#10b981' : nodeType === 'metric' ? '#22d3ee' : '#3b82f6', strokeWidth: 2 }
      });
    }
  }

  // Handle both array of root nodes and single root node object
  const rootNodes = Array.isArray(treeData) ? treeData : [treeData];
  rootNodes.forEach((root) => {
    traverse(root, 0, null);
  });

  return { nodes, edges };
}
