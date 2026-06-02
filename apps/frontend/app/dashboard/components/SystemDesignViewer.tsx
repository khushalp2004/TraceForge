"use client";

import { useMemo, useEffect } from "react";
import { ReactFlow, Controls, Background, MiniMap, Node, Edge, useNodesState, useEdgesState, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Database, Server, LayoutTemplate, Box, ServerCrash, Share2, Workflow } from "lucide-react";

export type SystemDesignComponent = {
  name: string;
  type: string;
  description: string;
  dependsOn: string[];
};

const nodeWidth = 250;
const nodeHeight = 80;

// A custom node component to render a premium look
const ArchitectureNode = ({ data }: { data: any }) => {
  const Icon = data.icon || Box;
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-solid bg-[hsl(var(--card))] shadow-sm" style={{ borderColor: data.color }}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-[hsl(var(--primary))]" />
      <div className="flex flex-1 items-center gap-3 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${data.color}20`, color: data.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-[hsl(var(--text-primary))]">{data.label}</span>
          <span className="truncate text-xs text-[hsl(var(--text-secondary))]">{data.description}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-[hsl(var(--primary))]" />
    </div>
  );
};

const nodeTypes = {
  architecture: ArchitectureNode
};

const getIconForType = (type: string) => {
  switch (type.toLowerCase()) {
    case "database": return Database;
    case "frontend": return LayoutTemplate;
    case "backend": return Server;
    case "cache": return Box;
    case "queue": return Workflow;
    case "load_balancer": return Share2;
    default: return Box;
  }
};

const getColorForType = (type: string) => {
  switch (type.toLowerCase()) {
    case "database": return "#3b82f6"; // Blue
    case "frontend": return "#ec4899"; // Pink
    case "backend": return "#10b981"; // Green
    case "cache": return "#f59e0b"; // Yellow
    case "queue": return "#8b5cf6"; // Purple
    case "load_balancer": return "#06b6d4"; // Cyan
    default: return "#9ca3af"; // Gray
  }
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 100 });

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

export function SystemDesignViewer({ systemDesign }: { systemDesign: SystemDesignComponent[] }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!systemDesign || systemDesign.length === 0) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Map names to IDs for reliable referencing
    const idMap = new Map<string, string>();
    systemDesign.forEach((comp, idx) => {
      idMap.set(comp.name, `node-${idx}`);
    });

    systemDesign.forEach((comp) => {
      const id = idMap.get(comp.name)!;
      nodes.push({
        id,
        type: "architecture",
        data: { 
          label: comp.name, 
          description: comp.description, 
          icon: getIconForType(comp.type),
          color: getColorForType(comp.type)
        },
        position: { x: 0, y: 0 },
        style: { width: nodeWidth, height: nodeHeight }
      });

      if (comp.dependsOn && Array.isArray(comp.dependsOn)) {
        comp.dependsOn.forEach((dep) => {
          // If the dependency exists in our map, create an edge
          // NOTE: DAG edges in ReactFlow usually go Source -> Target
          // If A depends on B, logically A -> B. We'll draw edge from A to B.
          const targetId = idMap.get(dep);
          if (targetId) {
            edges.push({
              id: `e-${id}-${targetId}`,
              source: id,
              target: targetId,
              animated: true,
              style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }
            });
          }
        });
      }
    });

    return getLayoutedElements(nodes, edges, "TB");
  }, [systemDesign]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!systemDesign || systemDesign.length === 0) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
        <ServerCrash className="mb-4 h-12 w-12 text-[hsl(var(--text-tertiary))]" />
        <h3 className="text-lg font-semibold text-[hsl(var(--text-primary))]">No System Design Found</h3>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1 max-w-sm text-center">
          The system design could not be confidently inferred for this repository. Try running the analysis again or reviewing the logs.
        </p>
      </div>
    );
  }

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
        nodeTypes={nodeTypes}
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
          nodeColor={(node) => (node.data.color as string) || "hsl(var(--secondary))"} 
        />
      </ReactFlow>
    </div>
  );
}
