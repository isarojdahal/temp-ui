// Pure, framework-free helpers for reading and immutably mutating a scorecard
// component tree (see backend scorecard/schemas.py for the shape: every node
// has {id, type, props, children}). A "path" is an array of child indices
// from the root, e.g. [] is the root itself, [2] is root.children[2], and
// [2, 0] is root.children[2].children[0].

export function generateNodeId() {
  return 'node-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function getNodeAtPath(root, path) {
  let node = root;
  for (const idx of path) {
    if (!node || !node.children || !node.children[idx]) return null;
    node = node.children[idx];
  }
  return node;
}

export function getParentPath(path) {
  return path.slice(0, -1);
}

export function pathsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// True if `ancestorPath` is the same as, or an ancestor of, `path`.
export function isAncestorOrSame(ancestorPath, path) {
  if (ancestorPath.length > path.length) return false;
  return ancestorPath.every((v, i) => v === path[i]);
}

// Returns a new root with the node at `path` replaced by updater(node).
export function updateAtPath(root, path, updater) {
  if (path.length === 0) return updater(root);
  const [idx, ...rest] = path;
  const children = (root.children || []).map((child, i) =>
    i === idx ? updateAtPath(child, rest, updater) : child
  );
  return { ...root, children };
}

export function deleteAtPath(root, path) {
  if (path.length === 0) throw new Error('Cannot delete the root node');
  const parentPath = getParentPath(path);
  const idx = path[path.length - 1];
  return updateAtPath(root, parentPath, (node) => ({
    ...node,
    children: (node.children || []).filter((_, i) => i !== idx),
  }));
}

export function insertAtPath(root, containerPath, index, newNode) {
  return updateAtPath(root, containerPath, (node) => {
    const children = node.children ? [...node.children] : [];
    const clampedIndex = Math.max(0, Math.min(index, children.length));
    children.splice(clampedIndex, 0, newNode);
    return { ...node, children };
  });
}

export function replacePropsAtPath(root, path, newProps) {
  return updateAtPath(root, path, (node) => ({ ...node, props: newProps }));
}

// Removing a node only shifts sibling indices *within its own parent array*.
// If `path` descends through that same parent array, the single index
// component at that depth needs decrementing when it pointed past the
// removed node; every other component (shallower or deeper) is untouched.
function adjustPathAfterRemoval(path, fromParentPath, fromIndex) {
  if (path.length <= fromParentPath.length) return path;
  for (let i = 0; i < fromParentPath.length; i++) {
    if (path[i] !== fromParentPath[i]) return path;
  }
  const depth = fromParentPath.length;
  if (path[depth] <= fromIndex) return path;
  const adjusted = [...path];
  adjusted[depth] = adjusted[depth] - 1;
  return adjusted;
}

// Moves an existing node (identified by its current path) to be a child of
// `toContainerPath` at `toIndex`. Refuses no-op / cycle-creating moves.
export function moveNode(root, fromPath, toContainerPath, toIndex) {
  if (fromPath.length === 0) return root; // never move the root
  if (isAncestorOrSame(fromPath, toContainerPath)) return root; // would create a cycle

  const target = getNodeAtPath(root, toContainerPath);
  if (!target || (target.type !== 'Grid' && target.type !== 'Flex')) return root;

  const node = getNodeAtPath(root, fromPath);
  if (!node) return root;

  const fromParentPath = getParentPath(fromPath);
  const fromIndex = fromPath[fromPath.length - 1];

  // Same-parent reorder: the insertion index must account for the removed
  // sibling shifting everything after it back by one.
  let adjustedIndex = toIndex;
  if (pathsEqual(fromParentPath, toContainerPath) && fromIndex < toIndex) {
    adjustedIndex = toIndex - 1;
  }

  // Cross-branch move: the container path itself may pass through the same
  // parent array (e.g. moving root.children[0] into root.children[1]), in
  // which case that single path component must also shift down by one.
  const adjustedContainerPath = adjustPathAfterRemoval(toContainerPath, fromParentPath, fromIndex);

  let newRoot = deleteAtPath(root, fromPath);
  newRoot = insertAtPath(newRoot, adjustedContainerPath, adjustedIndex, node);
  return newRoot;
}

// Builds a brand-new node of `componentType` from the registry entry's
// default props (registryEntry comes from GET /scorecard-registry).
export function createNodeFromRegistry(componentType, registryEntry) {
  return {
    id: generateNodeId(),
    type: componentType,
    props: { ...(registryEntry?.defaultProps || {}) },
    children: registryEntry?.container ? [] : undefined,
  };
}

export function findRegistryEntry(registry, componentType) {
  if (!registry) return null;
  for (const cat of registry.categories) {
    const found = cat.components.find((c) => c.type === componentType);
    if (found) return found;
  }
  return null;
}

export function countDescendants(node) {
  if (!node || !node.children) return 0;
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

export function findDepth(root, path) {
  return path.length + 1; // root itself is depth 1, matching backend MAX_NESTING_DEPTH
}
