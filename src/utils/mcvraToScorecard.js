// Bridges the MCVRA Graph Generator's output into the Scorecard Editor's
// indicator input, per the paper's Figure 1 ("Extracted Numeric Risk
// Indicators" sits between graph generation and scorecard generation).
//
// Important honesty note: this app has no survey-response/answer-selection
// feature, so there is no "live" filled-in assessment result to pull a real
// score from. Each generated question/metric node instead carries a set of
// *possible* answer choices (each with a configured score) - what a survey
// respondent could select. In the absence of an actual filled-in response,
// the average of a node's configured choice scores is used as a provisional
// risk value. That value is multiplied by the normalized workbook weightage
// and the parameter allocation before it is shown as a percentage contribution.

function resolveRawType(node) {
  return node?.data?.rawType || node?.type || '';
}

function resolveLabel(node) {
  return node?.data?.label || node?.name || node?.label || node?.data?.name || node?.id || 'Unnamed indicator';
}

function resolveNumber(node, keys) {
  for (const key of keys) {
    const value = node?.[key] ?? node?.data?.[key];
    const number = typeof value === 'string' ? Number(value.replace('%', '').trim()) : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function resolveWeightage(node) {
  return resolveNumber(node, ['weightage', 'weight', 'metric_weight', 'metricWeight']);
}

function resolveComponentPercentage(node) {
  return resolveNumber(node, ['component_percentage', 'componentPercentage', 'component_percent', 'componentPercent', 'component_weight']);
}

function resolveParameterPercentage(node) {
  return resolveNumber(node, ['parameter_percentage', 'parameterPercentage', 'parameter_percent', 'parameterPercent', 'parameter_weight']);
}

function resolveComponentAllocation(node) {
  return resolveComponentPercentage(node) ?? resolveNumber(node, ['weightage', 'weight', 'component_weightage', 'componentWeightage']);
}

function resolveIndicatorIdentity(node) {
  const identity =
    node?.data?.question_id ||
    node?.data?.column_name ||
    node?.data?.survey_variable ||
    node?.data?.metric_variable ||
    node?.question_id ||
    node?.column_name ||
    node?.survey_variable ||
    node?.metric_variable ||
    resolveLabel(node);
  return String(identity).trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveRiskScore(node) {
  const scores = resolveNumericValues(node);
  if (!scores.length) return null;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const scaleMax = resolveNumber(node, ['scaleMax', 'scale_max', 'maxScore', 'max_score']);
  const divisor = scaleMax > 1 ? scaleMax : average > 1 ? (average <= 5 ? 5 : 100) : 1;
  return Math.min(1, Math.max(0, average / divisor));
}

function resolveChoices(node) {
  const choices =
    node?.data?.choices ||
    node?.choices ||
    node?.data?.options ||
    node?.options ||
    node?.data?.answers ||
    node?.answers ||
    node?.data?.choice_scores ||
    node?.choice_scores;
  if (Array.isArray(choices)) return choices;
  if (choices && typeof choices === 'object') return Object.values(choices);
  const metricValues = node?.data?.metricValue?.value;
  if (Array.isArray(metricValues)) return metricValues;
  const snakeMetricValues = node?.data?.metric_value?.value || node?.metric_value?.value;
  if (Array.isArray(snakeMetricValues)) return snakeMetricValues;

  const formula = node?.data?.formula || node?.formula;
  if (Array.isArray(formula)) {
    const choiceScore = formula.find((token) => token?.mode === 'choiceScore' || token?.type === 'choiceScore');
    if (Array.isArray(choiceScore?.value)) return choiceScore.value;
  }

  return [];
}

function resolveNumericValues(node) {
  const choices = resolveChoices(node);
  let choiceScores = choices.map((choice) => {
    if (typeof choice === 'number') return choice;
    return choice?.score ?? choice?.value ?? choice?.numeric_value ?? choice?.numericValue;
  }).map(Number).filter(Number.isFinite);

  if (!choiceScores.length) {
    const formula = node?.data?.formula || node?.formula;
    if (Array.isArray(formula)) {
      const choiceScore = formula.find((token) => token?.mode === 'choiceScore' || token?.type === 'choiceScore');
      if (Array.isArray(choiceScore?.value)) {
        choiceScores = choiceScore.value
          .map((choice) => Number(choice?.value ?? choice?.score))
          .filter(Number.isFinite);
      }
    }
  }
  const directValue =
    node?.data?.score ??
    node?.data?.value ??
    node?.data?.numericValue ??
    node?.data?.numeric_value ??
    node?.data?.riskScore ??
    node?.score ??
    node?.value ??
    node?.numericValue ??
    node?.numeric_value ??
    node?.riskScore;
  return choiceScores.length ? choiceScores : [Number(directValue)].filter(Number.isFinite);
}

function extractFromNodes(nodes, edges) {
  if (!nodes.length) return [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = new Map();
  edges.forEach((e) => parentOf.set(e.target, e.source));

  function findPillar(nodeId) {
    let current = parentOf.get(nodeId);
    let guard = 0;
    while (current && guard < 50) {
      const parent = nodeById.get(current);
      if (!parent) break;
      if (resolveRawType(parent) === 'criteria') return resolveLabel(parent);
      current = parentOf.get(current);
      guard += 1;
    }
    return 'General';
  }

  const candidates = [];
  const seenIdentities = new Set();
  let seq = 1;

  nodes.forEach((node) => {
    const rawType = resolveRawType(node);
    // Criteria and text nodes are grouping/display nodes. Metric/question and
    // raster nodes are the workbook's score-bearing indicators.
    if (rawType === 'criteria' || rawType === 'text') return;

    const riskScore = resolveRiskScore(node);
    if (riskScore === null) return;
    const identity = resolveIndicatorIdentity(node);
    const componentPercentage = resolveComponentPercentage(node);
    const parameterPercentage = resolveParameterPercentage(node);
    const ancestors = [];
    let current = parentOf.get(node.id);
    let guard = 0;
    while (current && guard < 50) {
      const parent = nodeById.get(current);
      if (!parent) break;
      ancestors.push(parent);
      current = parentOf.get(current);
      guard += 1;
    }
    const parameterNode = ancestors.find((ancestor) => resolveParameterPercentage(ancestor) !== null);
    const componentNode = ancestors.find((ancestor) => resolveComponentPercentage(ancestor) !== null);
    if (seenIdentities.has(identity)) return;
    seenIdentities.add(identity);
    candidates.push({
      id: `mcvra-${node.id || seq}`,
      name: resolveLabel(node),
      pillar: findPillar(node.id),
      category: rawType || 'indicator',
      indicatorIdentity: identity,
      riskScore,
      weightage: resolveWeightage(node) ?? 1,
      componentPercentage: componentPercentage ?? (componentNode ? resolveComponentPercentage(componentNode) : null),
      parameterPercentage: parameterPercentage ?? (parameterNode ? resolveParameterPercentage(parameterNode) : null),
      unit: '',
    });
    seq += 1;
  });

  const groups = new Map();
  candidates.forEach((candidate) => {
    const groupKey = `${candidate.componentPercentage ?? 'component'}::${candidate.parameterPercentage ?? 'parameter'}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(candidate);
  });

  return candidates.map((candidate) => {
    const groupKey = `${candidate.componentPercentage ?? 'component'}::${candidate.parameterPercentage ?? 'parameter'}`;
    const group = groups.get(groupKey);
    const weightTotal = group.reduce((sum, item) => sum + Math.max(0, item.weightage), 0) || group.length;
    const normalizedWeight = Math.max(0, candidate.weightage) / weightTotal || 1 / group.length;
    const parameterPercentage = candidate.parameterPercentage ?? candidate.componentPercentage ?? 100;
    const weightedScore = candidate.riskScore * parameterPercentage * normalizedWeight;
    return {
      ...candidate,
      weightage: Math.round(candidate.weightage * 100) / 100,
      normalizedWeight: Math.round(normalizedWeight * 10000) / 10000,
      rawScorePercent: Math.round(candidate.riskScore * 10000) / 100,
      score: Math.round(weightedScore * 100) / 100,
      weightedScorePercent: Math.round(weightedScore * 100) / 100,
      scaleMin: 0,
      scaleMax: Math.round(parameterPercentage * normalizedWeight * 100) / 100,
      allocationFormula: `${Math.round(candidate.riskScore * 10000) / 100}% x ${Math.round(normalizedWeight * 10000) / 100}% x ${parameterPercentage}%`,
    };
  });
}

function flattenRawTree(treeData) {
  const nodes = [];
  const edges = [];
  let generatedId = 0;

  if (Array.isArray(treeData?.nodes)) {
    return {
      nodes: treeData.nodes,
      edges: Array.isArray(treeData.edges) ? treeData.edges : [],
    };
  }

  if (treeData?.graph) return flattenRawTree(treeData.graph);

  function visit(value, parentId = null) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, parentId));
      return;
    }

    const id = String(value.id || value.backend_id || `raw-node-${generatedId++}`);
    const rawType = value.type || value.node_type || (Array.isArray(value.children) ? 'criteria' : 'question');
    nodes.push({ ...value, id, type: rawType, data: { ...(value.data || {}), rawType, label: value.name || value.label || value.data?.label } });
    if (parentId) edges.push({ source: parentId, target: id });
    if (Array.isArray(value.children)) value.children.forEach((child) => visit(child, id));
  }

  visit(treeData);
  return { nodes, edges };
}

function extractLevelOneCriteria(treeData) {
  if (!treeData) return [];

  if (treeData?.graph) return extractLevelOneCriteria(treeData.graph);

  if (Array.isArray(treeData?.nodes)) {
    const nodes = treeData.nodes;
    const edges = Array.isArray(treeData.edges) ? treeData.edges : [];
    const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
    const childrenById = new Map();
    const childIds = new Set();
    edges.forEach((edge) => {
      const source = String(edge.source);
      const target = String(edge.target);
      if (!childrenById.has(source)) childrenById.set(source, []);
      childrenById.get(source).push(target);
      childIds.add(target);
    });
    const root = nodes.find((node) => !childIds.has(String(node.id)));
    if (!root) return [];
    return buildCriteriaIndicators(
      (childrenById.get(String(root.id)) || []).map((id) => nodeById.get(id)).filter(Boolean),
      childrenById,
      nodeById
    );
  }

  const roots = Array.isArray(treeData) ? treeData : [treeData];
  const root = roots[0];
  if (!root || !Array.isArray(root.children)) return [];

  const childrenById = new Map();
  const nodeById = new Map();
  function indexTree(node) {
    if (!node || typeof node !== 'object') return;
    const id = String(node.id || node.backend_id || `raw-${nodeById.size}`);
    nodeById.set(id, node);
    const children = Array.isArray(node.children) ? node.children : [];
    childrenById.set(id, children.map((child) => String(child.id || child.backend_id || `raw-${nodeById.size}`)));
    children.forEach(indexTree);
  }
  indexTree(root);

  return buildCriteriaIndicators(root.children, childrenById, nodeById);
}

function buildCriteriaIndicators(criteriaNodes, childrenById, nodeById) {
  const candidates = [];
  let sequence = 1;

  function collectRiskScores(node) {
    const scores = [];
    const ownScore = resolveRiskScore(node);
    if (ownScore !== null) scores.push(ownScore);
    const id = String(node.id || node.backend_id || '');
    (childrenById.get(id) || []).forEach((childId) => {
      const child = nodeById.get(String(childId));
      if (child) scores.push(...collectRiskScores(child));
    });
    return scores;
  }

  criteriaNodes.forEach((node) => {
    if (!node || resolveRawType(node) !== 'criteria') return;
    const riskScores = collectRiskScores(node);
    const riskScore = riskScores.length ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length : 0;
    const identity = resolveIndicatorIdentity(node);
    if (candidates.some((candidate) => candidate.indicatorIdentity === identity)) return;
    candidates.push({
      id: `mcvra-level1-${node.id || sequence}`,
      name: resolveLabel(node),
      pillar: 'Level 1 Criteria',
      category: 'criteria',
      indicatorIdentity: identity,
      componentPercentage: resolveComponentAllocation(node),
      riskScore: Math.min(1, Math.max(0, riskScore)),
      rawScorePercent: Math.round(riskScore * 10000) / 100,
      scaleMin: 0,
      unit: '',
      scoreDerived: riskScores.length > 0,
    });
    sequence += 1;
  });

  const configuredAllocations = candidates.map((candidate) => Math.max(0, Number(candidate.componentPercentage) || 0));
  const configuredTotal = configuredAllocations.reduce((sum, allocation) => sum + allocation, 0);
  const equalAllocation = 100 / (candidates.length || 1);

  return candidates.map((candidate, index) => {
    const allocationPercentage = configuredTotal > 0
      ? (configuredAllocations[index] / configuredTotal) * 100
      : equalAllocation;
    const weightedScore = candidate.riskScore * allocationPercentage;
    return {
      ...candidate,
      componentPercentage: Math.round(allocationPercentage * 100) / 100,
      score: Math.round(weightedScore * 100) / 100,
      weightedScorePercent: Math.round(weightedScore * 100) / 100,
      scaleMax: Math.round(allocationPercentage * 100) / 100,
      allocationFormula: `${candidate.rawScorePercent}% x ${Math.round(allocationPercentage * 100) / 100}% graph allocation`,
    };
  });
}

export function extractIndicatorsFromGraph(nodes = [], edges = [], rawTreeData = null) {
  const levelOneIndicators = extractLevelOneCriteria(rawTreeData);
  if (levelOneIndicators.length) return levelOneIndicators;
  const indicators = extractFromNodes(nodes, edges);
  if (indicators.length || !rawTreeData) return indicators;
  const flattened = flattenRawTree(rawTreeData);
  return extractFromNodes(flattened.nodes, flattened.edges);
}

export function extractOverallRiskFromIndicators(indicators = []) {
  if (!indicators.length) return '';
  const total = indicators.reduce((sum, indicator) => sum + Number(indicator.weightedScorePercent ?? indicator.score ?? 0), 0);
  return Math.round(total * 100) / 100;
}
