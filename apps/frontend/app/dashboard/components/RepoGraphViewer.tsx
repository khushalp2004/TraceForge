import { useMemo, useEffect } from "react";
import { ReactFlow, Controls, Background, MiniMap, Node, Edge, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

type GithubRepoTreeEntry = {
  path: string;
  type: "blob" | "tree";
  size?: number;
};

const nodeWidth = 220;
const nodeHeight = 50;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

export function RepoGraphViewer({ folderTree }: { folderTree: GithubRepoTreeEntry[] }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!folderTree || folderTree.length === 0) return { nodes: [], edges: [] };

    const limitedTree = folderTree.slice(0, 300);
    
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    nodes.push({
      id: "root",
      data: { label: "Repository Root" },
      position: { x: 0, y: 0 },
      style: { backgroundColor: "hsl(var(--primary))", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", padding: "10px", width: nodeWidth, height: nodeHeight }
    });

    const addedNodes = new Set<string>(["root"]);

    limitedTree.forEach((item) => {
      const parts = item.path.split("/");
      let currentPath = "";
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const parentPath = currentPath || "root";
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!addedNodes.has(currentPath)) {
          addedNodes.add(currentPath);
          
          nodes.push({
            id: currentPath,
            data: { label: part },
            position: { x: 0, y: 0 },
            style: isLast && item.type === "blob"
              ? { backgroundColor: "hsl(var(--card))", color: "hsl(var(--text-primary))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", padding: "8px", width: nodeWidth, height: nodeHeight }
              : { backgroundColor: "hsl(var(--accent-soft))", color: "hsl(var(--primary))", border: "1px dashed hsl(var(--primary))", fontWeight: "600", borderRadius: "8px", fontSize: "12px", padding: "8px", width: nodeWidth, height: nodeHeight }
          });

          edges.push({
            id: `e-${parentPath}-${currentPath}`,
            source: parentPath,
            target: currentPath,
            animated: isLast && item.type === "blob" ? false : true,
            style: { stroke: "hsl(var(--border))" }
          });
        }
      });
    });

    return getLayoutedElements(nodes, edges, "LR");
  }, [folderTree]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div style={{ height: "calc(100vh - 280px)", minHeight: "400px", width: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid hsl(var(--border))" }}>
      <style>{`
        .react-flow__controls-button {
          background-color: hsl(var(--card)) !important;
          border-color: hsl(var(--border)) !important;
          color: hsl(var(--text-primary)) !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
        }
        .react-flow__controls-button:hover {
          background-color: hsl(var(--secondary)) !important;
        }
        .react-flow__controls-button svg {
          fill: currentColor !important;
        }
        .react-flow__attribution {
          display: none !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.01}
        attributionPosition="bottom-right"
      >
        <Background gap={16} size={1} color="hsl(var(--border))" />
        <Controls />
        <MiniMap 
          zoomable 
          pannable 
          style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          maskColor="hsl(var(--background))"
          nodeColor="hsl(var(--secondary))" 
        />
      </ReactFlow>
    </div>
  );
}
