export interface LogicalLayoutResponse {
  siteId: number;
  expanded: boolean;
  playback: boolean;
  hasPhysical: boolean;
  logicalTree: LogicalTreeNode;
}

export interface LogicalTreeNode {
  data: LogicalTreeNodeData | null;
  numberOfChilds: number;
  childIds: number[];
  children: LogicalTreeNode[];
}

export interface LogicalTreeNodeData {
  id: number;
  serialNumber: string | null;
  name: string;
  displayName: string;
  relativeOrder: number;
  type: string;
  operationsKey: number;
}
