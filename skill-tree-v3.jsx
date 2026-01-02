import React, { useState, useCallback, useRef, useEffect } from 'react';

const SkillTreeBuilder = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  const defaultNodes = {
    'start': {
      id: 'start',
      name: 'Starting Point',
      description: 'Your journey begins here',
      xp: 0,
      requires: [],
      path: 'default',
      x: 450,
      y: 500,
      completed: false,
      isMajor: false
    }
  };

  const [nodes, setNodes] = useState(defaultNodes);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.7);
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState('select');
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(null);
  const [showCompletionEffect, setShowCompletionEffect] = useState(false);

  const pathOptions = [
    { id: 'business', name: 'Business', color: '#22c55e' },
    { id: 'content', name: 'Content', color: '#3b82f6' },
    { id: 'treasury', name: 'Treasury', color: '#eab308' },
    { id: 'freedom', name: 'Freedom', color: '#a855f7' },
    { id: 'income', name: 'Income', color: '#f59e0b' },
    { id: 'relationship', name: 'Relationship', color: '#ec4899' },
    { id: 'health', name: 'Health', color: '#10b981' },
    { id: 'learning', name: 'Learning', color: '#06b6d4' },
    { id: 'convergence', name: 'Convergence', color: '#ef4444' },
    { id: 'ultimate', name: 'Ultimate', color: '#fbbf24' },
    { id: 'default', name: 'Default', color: '#71717a' },
  ];

  const getPathColor = (pathId) => {
    return pathOptions.find(p => p.id === pathId)?.color || '#71717a';
  };

  // Load from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await window.storage.get('skill-tree-builder-v2');
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          setNodes(parsed.nodes || defaultNodes);
        }
      } catch (e) {
        console.log('No saved data, using defaults');
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Save to storage
  useEffect(() => {
    if (!loading) {
      window.storage.set('skill-tree-builder-v2', JSON.stringify({ nodes }));
    }
  }, [nodes, loading]);

  // Calculate instability and "next up" status
  const getNodeStatus = useCallback((node) => {
    const requirementsMet = node.requires.length === 0 || 
      node.requires.every(reqId => nodes[reqId]?.completed);
    
    if (node.completed) {
      // Check if unstable
      const checkUnstable = (nodeId, visited = new Set()) => {
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);
        const n = nodes[nodeId];
        if (!n || !n.completed) return false;
        for (const reqId of (n.requires || [])) {
          const reqNode = nodes[reqId];
          if (!reqNode || !reqNode.completed) return true;
          if (checkUnstable(reqId, visited)) return true;
        }
        return false;
      };
      
      return checkUnstable(node.id) ? 'unstable' : 'completed';
    }
    
    return requirementsMet ? 'available' : 'locked';
  }, [nodes]);

  // Mouse position helper
  const getMousePosition = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom
    };
  };

  // Handle node click in view mode
  const handleViewModeClick = (nodeId) => {
    const node = nodes[nodeId];
    const status = getNodeStatus(node);
    
    if (status === 'locked') {
      setSelectedNode(nodeId);
      return;
    }
    
    const wasCompleted = node.completed;
    
    setNodes(prev => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], completed: !prev[nodeId].completed }
    }));
    
    if (!wasCompleted) {
      setJustCompleted(nodeId);
      setShowCompletionEffect(true);
      setTimeout(() => {
        setShowCompletionEffect(false);
        setJustCompleted(null);
      }, 1500);
    }
  };

  // Dragging handlers for edit mode
  const handleMouseDown = (e, nodeId) => {
    if (!isEditMode) {
      handleViewModeClick(nodeId);
      return;
    }

    if (mode === 'connect') {
      if (connecting) {
        if (connecting !== nodeId) {
          setNodes(prev => {
            const updated = { ...prev };
            const targetNode = updated[nodeId];
            if (!targetNode.requires.includes(connecting)) {
              updated[nodeId] = {
                ...targetNode,
                requires: [...targetNode.requires, connecting]
              };
            }
            return updated;
          });
        }
        setConnecting(null);
      } else {
        setConnecting(nodeId);
      }
      return;
    }

    if (mode === 'delete') {
      deleteNode(nodeId);
      return;
    }

    e.stopPropagation();
    const pos = getMousePosition(e);
    const node = nodes[nodeId];
    setDragging(nodeId);
    setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
    setSelectedNode(nodeId);
  };

  const handleMouseMove = (e) => {
    if (!dragging || !isEditMode) return;
    const pos = getMousePosition(e);
    setNodes(prev => ({
      ...prev,
      [dragging]: {
        ...prev[dragging],
        x: Math.max(0, pos.x - dragOffset.x),
        y: Math.max(0, pos.y - dragOffset.y)
      }
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  // Node operations
  const addNode = () => {
    const id = `node-${Date.now()}`;
    const newNode = {
      id,
      name: 'New Node',
      description: 'Click to edit',
      xp: 100,
      requires: [],
      path: 'default',
      x: 450 + Math.random() * 100 - 50,
      y: 300 + Math.random() * 100 - 50,
      completed: false,
      isMajor: false
    };
    setNodes(prev => ({ ...prev, [id]: newNode }));
    setSelectedNode(id);
    setEditingNode(id);
  };

  const deleteNode = (nodeId) => {
    if (Object.keys(nodes).length <= 1) {
      alert("Can't delete the last node!");
      return;
    }
    setNodes(prev => {
      const updated = { ...prev };
      delete updated[nodeId];
      Object.keys(updated).forEach(key => {
        updated[key] = {
          ...updated[key],
          requires: updated[key].requires.filter(r => r !== nodeId)
        };
      });
      return updated;
    });
    if (selectedNode === nodeId) setSelectedNode(null);
    if (editingNode === nodeId) setEditingNode(null);
  };

  const updateNode = (nodeId, updates) => {
    setNodes(prev => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...updates }
    }));
  };

  const removeConnection = (fromId, toId) => {
    setNodes(prev => ({
      ...prev,
      [toId]: {
        ...prev[toId],
        requires: prev[toId].requires.filter(r => r !== fromId)
      }
    }));
  };

  const resetAll = () => {
    if (confirm('Reset everything? This will delete all your nodes.')) {
      setNodes(defaultNodes);
      setSelectedNode(null);
      setEditingNode(null);
    }
  };

  const exportData = () => {
    const data = JSON.stringify({ nodes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skill-tree-backup.json';
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.nodes) {
          setNodes(data.nodes);
          setSelectedNode(null);
          setEditingNode(null);
        }
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const getConnections = () => {
    const connections = [];
    Object.values(nodes).forEach(node => {
      (node.requires || []).forEach(reqId => {
        const reqNode = nodes[reqId];
        if (reqNode) {
          connections.push({ from: reqNode, to: node });
        }
      });
    });
    return connections;
  };

  const nodeWidth = 160;
  const nodeHeight = 75;
  const canvasWidth = 2000;
  const canvasHeight = 1500;

  const totalXP = Object.values(nodes).filter(n => n.completed).reduce((sum, n) => sum + (n.xp || 0), 0);
  const completedCount = Object.values(nodes).filter(n => n.completed).length;

  if (loading) {
    return (
      <div className="h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-amber-400 text-xl">Loading your skill tree...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-stone-950 overflow-hidden flex flex-col">
      {/* Completion Effect Overlay */}
      {showCompletionEffect && justCompleted && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="animate-ping absolute w-32 h-32 rounded-full opacity-30"
               style={{ backgroundColor: getPathColor(nodes[justCompleted]?.path) }} />
          <div className="relative bg-stone-900 border-2 rounded-xl p-6 animate-bounce shadow-2xl"
               style={{ borderColor: getPathColor(nodes[justCompleted]?.path) }}>
            <div className="text-4xl mb-2 text-center">⚔️</div>
            <div className="text-amber-400 font-bold text-xl text-center">ACHIEVED!</div>
            <div className="text-white text-center mt-1">{nodes[justCompleted]?.name}</div>
            <div className="text-amber-500 text-center text-lg font-bold mt-2">+{nodes[justCompleted]?.xp} XP</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-stone-900 border-b border-amber-900/50 p-3 z-20 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* View/Edit Toggle */}
          <div className="flex border-2 border-amber-600 rounded-lg overflow-hidden">
            <button
              onClick={() => { setIsEditMode(false); setConnecting(null); setEditingNode(null); }}
              className={`px-4 py-2 text-sm font-bold ${!isEditMode ? 'bg-amber-600 text-stone-900' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}
            >
              👁️ View
            </button>
            <button
              onClick={() => setIsEditMode(true)}
              className={`px-4 py-2 text-sm font-bold ${isEditMode ? 'bg-amber-600 text-stone-900' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}
            >
              ✏️ Edit
            </button>
          </div>

          {/* Edit mode tools */}
          {isEditMode && (
            <>
              <div className="w-px h-8 bg-stone-700" />
              <div className="flex border border-stone-700 rounded overflow-hidden">
                <button
                  onClick={() => { setMode('select'); setConnecting(null); }}
                  className={`px-3 py-1.5 text-sm ${mode === 'select' ? 'bg-amber-700 text-white' : 'bg-stone-800 text-stone-400'}`}
                >
                  ✋ Move
                </button>
                <button
                  onClick={() => { setMode('connect'); setConnecting(null); }}
                  className={`px-3 py-1.5 text-sm ${mode === 'connect' ? 'bg-blue-700 text-white' : 'bg-stone-800 text-stone-400'}`}
                >
                  🔗 Link
                </button>
                <button
                  onClick={() => { setMode('delete'); setConnecting(null); }}
                  className={`px-3 py-1.5 text-sm ${mode === 'delete' ? 'bg-red-700 text-white' : 'bg-stone-800 text-stone-400'}`}
                >
                  🗑️
                </button>
              </div>
              <button onClick={addNode} className="px-3 py-1.5 bg-green-800 text-green-200 rounded text-sm hover:bg-green-700">
                ➕ Add
              </button>
            </>
          )}

          <div className="w-px h-8 bg-stone-700" />

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="px-2 py-1 bg-stone-800 text-stone-400 rounded">−</button>
            <span className="text-stone-400 text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(1.2, z + 0.1))} className="px-2 py-1 bg-stone-800 text-stone-400 rounded">+</button>
          </div>

          <div className="w-px h-8 bg-stone-700" />

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-amber-400 font-bold text-lg">{totalXP.toLocaleString()}</div>
              <div className="text-stone-500 text-xs">XP</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-bold text-lg">{completedCount}/{Object.keys(nodes).length}</div>
              <div className="text-stone-500 text-xs">Done</div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Tools */}
          <button onClick={exportData} className="px-2 py-1 bg-stone-800 text-stone-400 rounded text-sm hover:bg-stone-700">💾</button>
          <label className="px-2 py-1 bg-stone-800 text-stone-400 rounded text-sm hover:bg-stone-700 cursor-pointer">
            📂
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
          {isEditMode && (
            <button onClick={resetAll} className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-sm hover:bg-red-900">Reset</button>
          )}
        </div>

        {/* Mode hints */}
        {isEditMode && mode === 'connect' && (
          <div className="mt-2 text-sm text-blue-400">
            🔗 {connecting ? `Now click the node that NEEDS "${nodes[connecting]?.name}"` : 'Click the requirement node first'}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto touch-pan-x touch-pan-y"
        style={{ background: 'radial-gradient(ellipse at center, #1c1917 0%, #0c0a09 50%, #000 100%)' }}
      >
        <svg 
          ref={svgRef}
          width={canvasWidth * zoom} 
          height={canvasHeight * zoom} 
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={(e) => handleMouseMove(e.touches[0])}
          onTouchEnd={handleMouseUp}
          className="block"
          style={{ minWidth: canvasWidth * zoom, minHeight: canvasHeight * zoom }}
        >
          <defs>
            {/* Grid */}
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#27272a" strokeWidth="0.5" />
            </pattern>
            
            {/* Glows for each path */}
            {pathOptions.map(p => (
              <filter key={p.id} id={`glow-${p.id}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feFlood floodColor={p.color} floodOpacity="0.6" result="glowColor"/>
                <feComposite in="glowColor" in2="coloredBlur" operator="in" result="softGlow"/>
                <feMerge>
                  <feMergeNode in="softGlow"/>
                  <feMergeNode in="softGlow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            ))}
            
            {/* Available/Next-up pulse glow */}
            <filter id="glow-available" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
              <feFlood floodColor="#fbbf24" floodOpacity="0.4" result="glowColor"/>
              <feComposite in="glowColor" in2="coloredBlur" operator="in" result="softGlow"/>
              <feMerge>
                <feMergeNode in="softGlow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Unstable glow */}
            <filter id="glow-unstable" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
              <feFlood floodColor="#ef4444" floodOpacity="0.7" result="glowColor"/>
              <feComposite in="glowColor" in2="coloredBlur" operator="in" result="softGlow"/>
              <feMerge>
                <feMergeNode in="softGlow"/>
                <feMergeNode in="softGlow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Animated gradient for active lines */}
            <linearGradient id="lineGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fbbf24">
                <animate attributeName="offset" values="-1;1" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#fff">
                <animate attributeName="offset" values="-0.5;1.5" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#fbbf24">
                <animate attributeName="offset" values="0;2" dur="2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Connection lines */}
          {getConnections().map((conn, i) => {
            const fromX = conn.from.x + nodeWidth / 2;
            const fromY = conn.from.y + nodeHeight / 2;
            const toX = conn.to.x + nodeWidth / 2;
            const toY = conn.to.y + nodeHeight / 2;
            
            const fromStatus = getNodeStatus(conn.from);
            const toStatus = getNodeStatus(conn.to);
            const isActive = fromStatus === 'completed' && toStatus === 'completed';
            const isPartial = fromStatus === 'completed' && toStatus !== 'completed';
            const isUnstable = toStatus === 'unstable';
            
            const color = isUnstable ? '#ef4444' : 
                         isActive ? getPathColor(conn.to.path) : 
                         isPartial ? getPathColor(conn.to.path) :
                         '#27272a';
            
            const dx = toX - fromX;
            const dy = toY - fromY;
            const midX = fromX + dx / 2;
            const midY = fromY + dy / 2;
            
            // Curved path
            const ctrl1X = fromX + dx * 0.25;
            const ctrl1Y = fromY;
            const ctrl2X = fromX + dx * 0.75;
            const ctrl2Y = toY;
            
            const path = `M ${fromX} ${fromY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${toX} ${toY}`;
            
            return (
              <g key={i}>
                {/* Glow effect for active lines */}
                {isActive && (
                  <path
                    d={path}
                    stroke={color}
                    strokeWidth={8}
                    fill="none"
                    opacity={0.3}
                    className="blur-sm"
                  />
                )}
                
                {/* Main line */}
                <path
                  d={path}
                  stroke={color}
                  strokeWidth={isActive ? 4 : isPartial ? 3 : 2}
                  fill="none"
                  opacity={isActive ? 1 : isPartial ? 0.7 : 0.2}
                  strokeDasharray={isPartial && !isActive ? '8,4' : 'none'}
                  className={isUnstable ? 'animate-pulse' : ''}
                />

                {/* Animated particles on active lines */}
                {isActive && (
                  <circle r="4" fill="#fff" opacity="0.8">
                    <animateMotion dur="2s" repeatCount="indefinite" path={path} />
                  </circle>
                )}

                {/* Arrow at end */}
                <circle
                  cx={toX}
                  cy={toY}
                  r={isActive ? 8 : 5}
                  fill={color}
                  opacity={isActive ? 1 : isPartial ? 0.6 : 0.2}
                />
              </g>
            );
          })}

          {/* Connecting line preview */}
          {connecting && isEditMode && (
            <line
              x1={nodes[connecting].x + nodeWidth / 2}
              y1={nodes[connecting].y + nodeHeight / 2}
              x2={nodes[connecting].x + nodeWidth / 2 + 80}
              y2={nodes[connecting].y + nodeHeight / 2}
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray="8,4"
              className="animate-pulse"
            />
          )}

          {/* Nodes */}
          {Object.values(nodes).map(node => {
            const color = getPathColor(node.path);
            const status = getNodeStatus(node);
            const isSelected = selectedNode === node.id;
            const isConnecting = connecting === node.id;
            const isJustCompleted = justCompleted === node.id;
            
            let fillColor, strokeColor, textColor, opacity, filter;
            
            switch (status) {
              case 'completed':
                fillColor = color + '40';
                strokeColor = color;
                textColor = '#ffffff';
                opacity = 1;
                filter = `url(#glow-${node.path})`;
                break;
              case 'unstable':
                fillColor = '#450a0a';
                strokeColor = '#ef4444';
                textColor = '#fca5a5';
                opacity = 1;
                filter = 'url(#glow-unstable)';
                break;
              case 'available':
                fillColor = '#1c1917';
                strokeColor = color;
                textColor = '#fafaf9';
                opacity = 1;
                filter = 'url(#glow-available)';
                break;
              case 'locked':
              default:
                fillColor = '#0c0a09';
                strokeColor = '#27272a';
                textColor = '#3f3f46';
                opacity = 0.4;
                filter = '';
                break;
            }

            return (
              <g 
                key={node.id}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onTouchStart={(e) => { e.preventDefault(); handleMouseDown(e, node.id); }}
                onDoubleClick={() => isEditMode && setEditingNode(node.id)}
                className={`${isEditMode ? (mode === 'delete' ? 'cursor-pointer' : mode === 'connect' ? 'cursor-crosshair' : 'cursor-grab') : 'cursor-pointer'} 
                           ${dragging === node.id ? 'cursor-grabbing' : ''} 
                           ${status === 'unstable' ? 'animate-pulse' : ''}`}
                style={{ filter, opacity }}
              >
                {/* Selection ring */}
                {(isSelected || isConnecting) && (
                  <rect
                    x={node.x - 6}
                    y={node.y - 6}
                    width={nodeWidth + 12}
                    height={nodeHeight + 12}
                    rx={12}
                    fill="none"
                    stroke={isConnecting ? '#3b82f6' : '#fbbf24'}
                    strokeWidth="3"
                    strokeDasharray={isConnecting ? '8,4' : 'none'}
                    className={isConnecting ? 'animate-pulse' : ''}
                  />
                )}

                {/* Pulsing ring for available nodes */}
                {status === 'available' && !isEditMode && (
                  <rect
                    x={node.x - 4}
                    y={node.y - 4}
                    width={nodeWidth + 8}
                    height={nodeHeight + 8}
                    rx={10}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    opacity="0.5"
                    className="animate-pulse"
                  />
                )}

                {/* Node background */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={node.isMajor ? 12 : 8}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={node.isMajor || status === 'completed' ? 4 : 2}
                />
                
                {/* Completed checkmark badge */}
                {status === 'completed' && (
                  <g>
                    <circle cx={node.x + nodeWidth - 14} cy={node.y + 14} r={14} fill={color} />
                    <text x={node.x + nodeWidth - 14} y={node.y + 20} fill="#000" fontSize="16" textAnchor="middle" fontWeight="bold">✓</text>
                  </g>
                )}
                
                {/* Unstable warning */}
                {status === 'unstable' && (
                  <text x={node.x + nodeWidth - 16} y={node.y + 22} fontSize="20">⚠️</text>
                )}

                {/* Lock icon for locked nodes */}
                {status === 'locked' && (
                  <text x={node.x + nodeWidth - 16} y={node.y + 20} fontSize="14" opacity="0.5">🔒</text>
                )}

                {/* Node name */}
                <text
                  x={node.x + nodeWidth / 2}
                  y={node.y + 32}
                  fill={textColor}
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.name.length > 18 ? node.name.slice(0, 16) + '...' : node.name}
                </text>
                
                {/* XP */}
                <text
                  x={node.x + nodeWidth / 2}
                  y={node.y + 54}
                  fill={textColor}
                  fontSize="13"
                  fontWeight="600"
                  textAnchor="middle"
                  opacity="0.8"
                  style={{ pointerEvents: 'none' }}
                >
                  +{node.xp} XP
                </text>

                {/* Available hint */}
                {status === 'available' && !isEditMode && (
                  <text
                    x={node.x + nodeWidth / 2}
                    y={node.y + nodeHeight + 18}
                    fill="#fbbf24"
                    fontSize="11"
                    textAnchor="middle"
                    className="animate-pulse"
                  >
                    Tap to complete
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Info (View Mode) */}
      {selectedNode && !isEditMode && nodes[selectedNode] && (
        <div className="fixed bottom-4 right-4 z-30 bg-stone-900/98 backdrop-blur border-2 rounded-xl p-4 max-w-xs shadow-2xl"
             style={{ borderColor: getPathColor(nodes[selectedNode].path) }}>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold" style={{ color: getPathColor(nodes[selectedNode].path) }}>
              {nodes[selectedNode].name}
            </h3>
            <button onClick={() => setSelectedNode(null)} className="text-stone-500 hover:text-stone-300 text-xl">×</button>
          </div>
          <p className="text-stone-300 text-sm mb-3">{nodes[selectedNode].description}</p>
          <div className="text-amber-400 font-bold mb-3">+{nodes[selectedNode].xp} XP</div>
          
          {nodes[selectedNode].requires.length > 0 && getNodeStatus(nodes[selectedNode]) === 'locked' && (
            <div className="pt-2 border-t border-stone-700">
              <div className="text-stone-500 text-xs mb-1">Requires:</div>
              <div className="flex flex-wrap gap-1">
                {nodes[selectedNode].requires.map(reqId => {
                  const reqNode = nodes[reqId];
                  const reqStatus = getNodeStatus(reqNode);
                  return (
                    <span 
                      key={reqId} 
                      className={`text-xs px-2 py-1 rounded ${reqStatus === 'completed' ? 'bg-green-900/50 text-green-300' : 'bg-stone-800 text-stone-400'}`}
                    >
                      {reqStatus === 'completed' ? '✓ ' : ''}{reqNode?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Panel */}
      {editingNode && isEditMode && nodes[editingNode] && (
        <div className="fixed right-4 top-20 z-30 bg-stone-900 border border-amber-800/50 rounded-lg p-4 w-80 shadow-xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-amber-400 font-bold">Edit Node</h3>
            <button onClick={() => setEditingNode(null)} className="text-stone-500 hover:text-stone-300 text-xl">×</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-stone-400 text-sm block mb-1">Name</label>
              <input
                type="text"
                value={nodes[editingNode].name}
                onChange={(e) => updateNode(editingNode, { name: e.target.value })}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded text-amber-100"
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm block mb-1">Description</label>
              <textarea
                value={nodes[editingNode].description}
                onChange={(e) => updateNode(editingNode, { description: e.target.value })}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded text-amber-100 h-20"
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm block mb-1">XP Reward</label>
              <input
                type="number"
                value={nodes[editingNode].xp}
                onChange={(e) => updateNode(editingNode, { xp: parseInt(e.target.value) || 0 })}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded text-amber-100"
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm block mb-1">Category</label>
              <select
                value={nodes[editingNode].path}
                onChange={(e) => updateNode(editingNode, { path: e.target.value })}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded text-amber-100"
              >
                {pathOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="w-full h-2 mt-1 rounded" style={{ backgroundColor: getPathColor(nodes[editingNode].path) }} />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isMajor"
                checked={nodes[editingNode].isMajor}
                onChange={(e) => updateNode(editingNode, { isMajor: e.target.checked })}
              />
              <label htmlFor="isMajor" className="text-stone-300 text-sm">Major milestone</label>
            </div>

            {nodes[editingNode].requires.length > 0 && (
              <div>
                <label className="text-stone-400 text-sm block mb-1">Requirements</label>
                <div className="space-y-1">
                  {nodes[editingNode].requires.map(reqId => (
                    <div key={reqId} className="flex items-center justify-between bg-stone-800 p-2 rounded">
                      <span className="text-stone-300 text-sm">{nodes[reqId]?.name}</span>
                      <button onClick={() => removeConnection(reqId, editingNode)} className="text-red-400 text-sm">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => deleteNode(editingNode)}
              className="w-full py-2 bg-red-900/50 text-red-400 rounded hover:bg-red-900 mt-4"
            >
              🗑️ Delete Node
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="fixed bottom-4 left-4 z-20 bg-stone-900/95 backdrop-blur border border-stone-700 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {pathOptions.slice(0, 8).map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: p.color }}></div>
              <span className="text-stone-400">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-stone-700 text-xs text-stone-500">
          {!isEditMode && "Tap glowing nodes to complete"}
        </div>
      </div>
    </div>
  );
};

export default SkillTreeBuilder;
