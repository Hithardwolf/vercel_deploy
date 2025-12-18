import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload } from 'lucide-react';

const DFDVisualizer = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [diagramData, setDiagramData] = useState(null);
  const [error, setError] = useState('');
  const [newProcessName, setNewProcessName] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newFlowSource, setNewFlowSource] = useState('');
  const [newFlowProcess, setNewFlowProcess] = useState('');
  const [newFlowTarget, setNewFlowTarget] = useState('');
  const [selectedShape, setSelectedShape] = useState(null);
  const canvasRef = useRef(null);

  const drawArrow = useCallback((ctx, x1, y1, x2, y2) => {
    const headlen = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    const startOffset = 50;
    const endOffset = 50;
    const length = Math.sqrt(dx * dx + dy * dy);

    const startX = x1 + dx * (startOffset / length);
    const startY = y1 + dy * (startOffset / length);
    const endX = x2 - dx * (endOffset / length);
    const endY = y2 - dy * (endOffset / length);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headlen * Math.cos(angle - Math.PI / 6),
      endY - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headlen * Math.cos(angle + Math.PI / 6),
      endY - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }, []);

  const wrapText = useCallback((ctx, text, x, y, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);

    const lineHeight = 14;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineHeight);
    });
  }, []);

  const drawExternalEntity = useCallback((ctx, x, y, label) => {
    const width = 120;
    const height = 60;
    
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(x - width/2, y - height/2, width, height);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - width/2, y - height/2, width, height);
    
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, label, x, y, width - 10);
  }, [wrapText]);

  const drawProcess = useCallback((ctx, x, y, label) => {
    const radius = 50;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#dcfce7';
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, label, x, y, radius * 1.6);
  }, [wrapText]);

  const drawDataStore = useCallback((ctx, x, y, label) => {
    const width = 140;
    const height = 60;
    
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(x - width/2, y - height/2);
    ctx.lineTo(x + width/2, y - height/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x - width/2, y + height/2);
    ctx.lineTo(x + width/2, y + height/2);
    ctx.stroke();
    
    ctx.fillStyle = '#7c3aed';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, label, x, y, width - 10);
  }, [wrapText]);

  const parseJSON = useCallback(() => {
    if (!jsonInput) return;
    
    try {
      const data = JSON.parse(jsonInput);
      const features = data["DFD features"];
      
      if (!features) {
        throw new Error('Missing "DFD features" key');
      }

      const flows = features.data_flows.map(flow => {
        const match = flow.match(/\d+\.\s*(.+?)\s*→\s*(.+?)\s*→\s*(.+)/);
        if (match) {
          return {
            source: match[1].trim(),
            process: match[2].trim(),
            target: match[3].trim()
          };
        }
        return null;
      }).filter(Boolean);

      const parsed = {
        external_entities: features.external_entities || [],
        processes: features.processes || [],
        data_stores: features.data_stores || [],
        data_flows: flows,
        deployment: features.deployment || '',
        piidata: features.piidata || []
      };
      setDiagramData(parsed);
      setError('');
    } catch (e) {
      setError(`Parse Error: ${e.message}`);
      setDiagramData(null);
    }
  }, [jsonInput]);

  const drawDFD = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !diagramData) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(40, 80, width - 80, height - 140);
    ctx.setLineDash([]);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Trust Boundary: ${diagramData.deployment}`, 50, 70);

    const entities = diagramData.external_entities;
    const processes = diagramData.processes;
    const stores = diagramData.data_stores;

    const positions = {};
    const padding = 100;
    const sectionWidth = (width - 2 * padding) / 3;

    entities.forEach((entity, i) => {
      positions[entity] = {
        x: padding + sectionWidth * 0.3,
        y: 150 + i * 120,
        type: 'entity'
      };
    });

    processes.forEach((process, i) => {
      positions[process] = {
        x: padding + sectionWidth * 1.5,
        y: 150 + i * 120,
        type: 'process'
      };
    });

    stores.forEach((store, i) => {
      positions[store] = {
        x: padding + sectionWidth * 2.7,
        y: 150 + i * 120,
        type: 'store'
      };
    });

    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.lineWidth = 2;

    diagramData.data_flows.forEach(flow => {
      const sourcePos = positions[flow.source];
      const processPos = positions[flow.process];
      const targetPos = positions[flow.target];

      if (sourcePos && processPos) {
        drawArrow(ctx, sourcePos.x, sourcePos.y, processPos.x, processPos.y);
      }
      if (processPos && targetPos) {
        drawArrow(ctx, processPos.x, processPos.y, targetPos.x, targetPos.y);
      }
    });

    Object.entries(positions).forEach(([name, pos]) => {
      if (pos.type === 'entity') {
        drawExternalEntity(ctx, pos.x, pos.y, name);
      } else if (pos.type === 'process') {
        drawProcess(ctx, pos.x, pos.y, name);
      } else if (pos.type === 'store') {
        drawDataStore(ctx, pos.x, pos.y, name);
      }
    });

    let maxY = 0;
    Object.values(positions).forEach(pos => {
      if (pos.type === 'entity') maxY = Math.max(maxY, pos.y + 50);
      else if (pos.type === 'process') maxY = Math.max(maxY, pos.y + 50);
      else if (pos.type === 'store') maxY = Math.max(maxY, pos.y + 30);
    });

    if (diagramData.piidata.length > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('⚠ PII Data:', 50, height - 40);
      ctx.font = '12px sans-serif';
      ctx.fillText(diagramData.piidata.join(', '), 140, height - 40);
    }

    // Enhanced Legend
    const legendX = 50;
    let legendY = Math.max(maxY + 80, height - 180);
    
    const legendWidth = width - 100;
    const legendHeight = 140;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(legendX - 10, legendY - 35, legendWidth, legendHeight);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(legendX - 10, legendY - 35, legendWidth, legendHeight);
    
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Legend', legendX, legendY - 10);
    
    const itemSpacing = 280;
    const rowSpacing = 55;
    let currentX = legendX;
    let currentY = legendY + 25;
    
    // External Entity
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(currentX, currentY - 12, 35, 24);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.strokeRect(currentX, currentY - 12, 35, 24);
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px sans-serif';
    ctx.fillText('External Entity', currentX + 50, currentY + 2);
    currentX += itemSpacing;
    
    // Process
    ctx.beginPath();
    ctx.arc(currentX + 18, currentY, 14, 0, 2 * Math.PI);
    ctx.fillStyle = '#dcfce7';
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Process', currentX + 50, currentY + 2);
    currentX += itemSpacing;
    
    // Data Store
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, currentY - 12);
    ctx.lineTo(currentX + 35, currentY - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(currentX, currentY + 12);
    ctx.lineTo(currentX + 35, currentY + 12);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Data Store', currentX + 50, currentY + 2);
    
    // Row 2
    currentX = legendX;
    currentY += rowSpacing;
    
    // Data Flow
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(currentX + 30, currentY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(currentX + 30, currentY);
    ctx.lineTo(currentX + 24, currentY - 5);
    ctx.moveTo(currentX + 30, currentY);
    ctx.lineTo(currentX + 24, currentY + 5);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Data Flow', currentX + 50, currentY + 2);
    currentX += itemSpacing;
    
    // Trust Boundary
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(currentX + 35, currentY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Trust Boundary', currentX + 50, currentY + 2);
    currentX += itemSpacing;
    
    // PII Indicator
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⚠', currentX + 5, currentY + 4);
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px sans-serif';
    ctx.fillText('PII Data', currentX + 50, currentY + 2);
  }, [diagramData, drawExternalEntity, drawProcess, drawDataStore, drawArrow]);

  useEffect(() => {
    if (diagramData && canvasRef.current) {
      drawDFD();
    }
  }, [diagramData, drawDFD]);

  const addProcess = () => {
    if (diagramData && newProcessName.trim()) {
      const updatedData = {
        ...diagramData,
        processes: [...diagramData.processes, newProcessName.trim()]
      };
      setDiagramData(updatedData);
      setNewProcessName('');
    }
  };

  const addEntity = () => {
    if (diagramData && newEntityName.trim()) {
      const updatedData = {
        ...diagramData,
        external_entities: [...diagramData.external_entities, newEntityName.trim()]
      };
      setDiagramData(updatedData);
      setNewEntityName('');
    }
  };

  const addDataStore = () => {
    if (diagramData && newStoreName.trim()) {
      const updatedData = {
        ...diagramData,
        data_stores: [...diagramData.data_stores, newStoreName.trim()]
      };
      setDiagramData(updatedData);
      setNewStoreName('');
    }
  };

  const addDataFlow = () => {
    if (diagramData && newFlowSource.trim() && newFlowProcess.trim() && newFlowTarget.trim()) {
      const updatedData = {
        ...diagramData,
        data_flows: [...diagramData.data_flows, {
          source: newFlowSource.trim(),
          process: newFlowProcess.trim(),
          target: newFlowTarget.trim()
        }]
      };
      setDiagramData(updatedData);
      setNewFlowSource('');
      setNewFlowProcess('');
      setNewFlowTarget('');
    }
  };

  const removeElement = (type, name) => {
    if (!diagramData) return;
    const updatedData = { ...diagramData };
    
    if (type === 'entity') {
      updatedData.external_entities = updatedData.external_entities.filter(e => e !== name);
    } else if (type === 'process') {
      updatedData.processes = updatedData.processes.filter(p => p !== name);
    } else if (type === 'store') {
      updatedData.data_stores = updatedData.data_stores.filter(s => s !== name);
    }
    
    updatedData.data_flows = updatedData.data_flows.filter(
      flow => flow.source !== name && flow.process !== name && flow.target !== name
    );
    
    setDiagramData(updatedData);
  };

  const removeDataFlow = (index) => {
    if (!diagramData) return;
    const updatedData = {
      ...diagramData,
      data_flows: diagramData.data_flows.filter((_, i) => i !== index)
    };
    setDiagramData(updatedData);
  };

  const getAllElements = () => {
    if (!diagramData) return [];
    return [
      ...diagramData.external_entities,
      ...diagramData.processes,
      ...diagramData.data_stores
    ];
  };

  const downloadDiagram = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'dfd-diagram.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Data Flow Diagram Visualizer</h1>
          <p className="text-slate-600 mb-6">Parse and visualize Data Flow Diagrams from JSON input</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                JSON Input
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-96 p-4 border-2 border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder='Paste your JSON here...'
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={parseJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Upload size={16} />
                  Parse & Render
                </button>
                <button
                  onClick={downloadDiagram}
                  disabled={!diagramData}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
                >
                  <Download size={16} />
                  Download PNG
                </button>
              </div>
              {diagramData && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-slate-800 mb-3">Add Elements</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">External Entity</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEntityName}
                          onChange={(e) => setNewEntityName(e.target.value)}
                          placeholder="e.g., User"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={addEntity}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Process</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newProcessName}
                          onChange={(e) => setNewProcessName(e.target.value)}
                          placeholder="e.g., Validate Data"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={addProcess}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Data Store</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newStoreName}
                          onChange={(e) => setNewStoreName(e.target.value)}
                          placeholder="e.g., Database"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={addDataStore}
                          className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-300">
                      <label className="text-xs font-medium text-slate-600 mb-2 block">Data Flow (Source → Process → Target)</label>
                      <div className="space-y-2">
                        <select
                          value={newFlowSource}
                          onChange={(e) => setNewFlowSource(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select Source</option>
                          {getAllElements().map((elem, i) => (
                            <option key={i} value={elem}>{elem}</option>
                          ))}
                        </select>
                        <select
                          value={newFlowProcess}
                          onChange={(e) => setNewFlowProcess(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select Process</option>
                          {getAllElements().map((elem, i) => (
                            <option key={i} value={elem}>{elem}</option>
                          ))}
                        </select>
                        <select
                          value={newFlowTarget}
                          onChange={(e) => setNewFlowTarget(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select Target</option>
                          {getAllElements().map((elem, i) => (
                            <option key={i} value={elem}>{elem}</option>
                          ))}
                        </select>
                        <button
                          onClick={addDataFlow}
                          disabled={!newFlowSource || !newFlowProcess || !newFlowTarget}
                          className="w-full px-4 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Add Data Flow
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Parsed Elements
              </label>
              {diagramData && (
                <div className="space-y-3">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-slate-800 text-sm mb-2">Summary:</h3>
                    <div className="text-xs space-y-1 text-slate-700">
                      <p>📦 <strong>{diagramData.external_entities.length}</strong> External Entities</p>
                      <p>⚙️ <strong>{diagramData.processes.length}</strong> Processes</p>
                      <p>💾 <strong>{diagramData.data_stores.length}</strong> Data Stores</p>
                      <p>➡️ <strong>{diagramData.data_flows.length}</strong> Data Flows</p>
                      <p>⚠️ <strong>{diagramData.piidata.length}</strong> PII Data Items</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                    <h3 className="font-semibold text-slate-800 text-sm mb-2">All Elements:</h3>
                    
                    {diagramData.external_entities.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">External Entities:</p>
                        <div className="flex flex-wrap gap-1">
                          {diagramData.external_entities.map((entity, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {entity}
                              <button
                                onClick={() => removeElement('entity', entity)}
                                className="text-blue-600 hover:text-blue-800 font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {diagramData.processes.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-green-700 mb-1">Processes:</p>
                        <div className="flex flex-wrap gap-1">
                          {diagramData.processes.map((process, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              {process}
                              <button
                                onClick={() => removeElement('process', process)}
                                className="text-green-600 hover:text-green-800 font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {diagramData.data_stores.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-purple-700 mb-1">Data Stores:</p>
                        <div className="flex flex-wrap gap-1">
                          {diagramData.data_stores.map((store, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                              {store}
                              <button
                                onClick={() => removeElement('store', store)}
                                className="text-purple-600 hover:text-purple-800 font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {diagramData.data_flows.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-cyan-700 mb-1">Data Flows:</p>
                        <div className="space-y-1">
                          {diagramData.data_flows.map((flow, i) => (
                            <div key={i} className="flex items-center justify-between px-2 py-1 bg-cyan-50 rounded text-xs">
                              <span className="text-cyan-800">
                                {flow.source} → {flow.process} → {flow.target}
                              </span>
                              <button
                                onClick={() => removeDataFlow(i)}
                                className="text-cyan-600 hover:text-cyan-800 font-bold"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">DFD Visualization</h2>
          <div className="overflow-auto border-2 border-slate-300 rounded-lg">
            <canvas
              ref={canvasRef}
              width={1400}
              height={800}
              className="bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DFDVisualizer;