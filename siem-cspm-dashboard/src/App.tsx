import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ForceGraph2D from 'react-force-graph-2d';
import './App.css';

function App() {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [azureTenant, setAzureTenant] = useState('');
  const [gcpJson, setGcpJson] = useState('');
  const [role, setRole] = useState<'Admin' | 'Analyst'>('Analyst');
  
  const [activeTab, setActiveTab] = useState('Dashboard');

  const [logs, setLogs] = useState<any[]>([]);
  const [dslQuery, setDslQuery] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [cspmFindings, setCspmFindings] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    invoke('check_aws_credentials')
      .then((res) => {
        setIsSetup(res as boolean);
        if (res) setRole('Admin'); 
      })
      .catch(console.error);
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke('save_aws_credentials', { accessKey: awsAccessKey, secretKey: awsSecretKey });
      // In a real app we'd save Azure/GCP keys too via tauri invoke
      setIsSetup(true);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await invoke('query_logs', { query: dslQuery });
      setLogs(JSON.parse(res as string));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await invoke('fetch_alerts');
      setAlerts(JSON.parse(res as string));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCspm = async () => {
    try {
      const res = await invoke('run_cspm_scan');
      setCspmFindings(JSON.parse(res as string));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const res = await invoke('detect_anomalies');
      setAnomalies(JSON.parse(res as string));
    } catch (e) {
      console.error(e);
    }
  };

  const runSimulation = async () => {
    try {
      const res = await invoke('run_stratus_simulation');
      alert(res);
      fetchLogs();
      fetchAnomalies();
    } catch (e) {
      alert("Error running simulation: " + e);
    }
  };

  const runIngestion = async () => {
    try {
      const res = await invoke('trigger_ingestion');
      alert(res);
      fetchLogs();
      fetchAnomalies();
    } catch (e) {
      alert("Error running ingestion: " + e);
    }
  };

  const remediateS3 = async (resource: string) => {
    if (role !== 'Admin') {
      alert("RBAC Error: Only 'Admin' users can perform auto-remediation.");
      return;
    }
    try {
      const bucketName = resource.split(':::')[1] || "company-confidential-data";
      const res = await invoke('remediate_s3_public_access', { bucketName });
      alert(res);
      fetchCspm();
    } catch (e) {
      alert("Error remediating: " + e);
    }
  };

  const exportBenchmarkReport = () => {
    let csv = "Type,ID,Title,Severity,Status,Resource\n";
    cspmFindings.forEach(f => {
      csv += `CSPM,${f.rule_id},"${f.title}",${f.severity},${f.status},${f.resource}\n`;
    });
    alerts.forEach(a => {
      csv += `Alert,${a.id},"${a.rule_name}",${a.severity},OPEN,${a.source_ip}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "prowler_benchmark_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (isSetup) {
      fetchLogs();
      fetchAlerts();
      fetchCspm();
      fetchAnomalies();
    }
  }, [isSetup]);

  // Graph Data Memoization for Threat Graph
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeSet = new Set<string>();

    const addNode = (id: string, group: number, val: number, name: string) => {
      if (!nodeSet.has(id)) {
        nodes.push({ id, group, val, name });
        nodeSet.add(id);
      }
    };

    alerts.forEach(a => {
      addNode(a.source_ip, 1, 12, a.source_ip);
      addNode(a.rule_name, 2, 6, a.rule_name);
      links.push({ source: a.source_ip, target: a.rule_name });
    });

    anomalies.forEach(a => {
      addNode(a.source_ip, 1, 15, a.source_ip);
      addNode("Anomaly: Volumetric", 3, 5, "Anomaly: Volumetric");
      links.push({ source: a.source_ip, target: "Anomaly: Volumetric" });
    });

    logs.forEach(l => {
      if(l.cloud_provider) {
         addNode(l.cloud_provider, 4, 8, l.cloud_provider);
         addNode(l.source_ip, 1, 12, l.source_ip);
         links.push({ source: l.source_ip, target: l.cloud_provider });
      }
    });

    return { nodes, links };
  }, [alerts, anomalies, logs]);


  if (isSetup === null) return <div className="h-screen w-screen flex items-center justify-center bg-[#0d1117] text-white">Loading...</div>;

  if (!isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white overflow-y-auto py-10">
        <div className="p-8 bg-[#161b22] border border-[#30363d] rounded-xl shadow-lg max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-2 text-center text-blue-400">SIEM / CSPM Setup</h1>
          <p className="text-center text-gray-400 text-sm mb-6">Multi-Cloud Enterprise Edition v2.0</p>
          
          <form onSubmit={handleSetup} className="space-y-6">
            <div className="space-y-3">
               <h3 className="text-blue-300 font-semibold border-b border-[#30363d] pb-1">AWS Integration</h3>
               <div>
                 <label className="block text-xs font-medium mb-1 text-gray-400">AWS Access Key</label>
                 <input type="text" value={awsAccessKey} onChange={(e) => setAwsAccessKey(e.target.value)} className="w-full p-2 text-sm bg-[#0d1117] border border-[#30363d] rounded focus:outline-none focus:border-blue-500" required />
               </div>
               <div>
                 <label className="block text-xs font-medium mb-1 text-gray-400">AWS Secret Key</label>
                 <input type="password" value={awsSecretKey} onChange={(e) => setAwsSecretKey(e.target.value)} className="w-full p-2 text-sm bg-[#0d1117] border border-[#30363d] rounded focus:outline-none focus:border-blue-500" required />
               </div>
            </div>

            <div className="space-y-3">
               <h3 className="text-blue-300 font-semibold border-b border-[#30363d] pb-1">Azure Integration (Optional)</h3>
               <div>
                 <label className="block text-xs font-medium mb-1 text-gray-400">Azure Tenant ID</label>
                 <input type="text" value={azureTenant} onChange={(e) => setAzureTenant(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="w-full p-2 text-sm bg-[#0d1117] border border-[#30363d] rounded focus:outline-none focus:border-blue-500" />
               </div>
            </div>

            <div className="space-y-3">
               <h3 className="text-blue-300 font-semibold border-b border-[#30363d] pb-1">GCP Integration (Optional)</h3>
               <div>
                 <label className="block text-xs font-medium mb-1 text-gray-400">Service Account JSON Base64</label>
                 <input type="password" value={gcpJson} onChange={(e) => setGcpJson(e.target.value)} className="w-full p-2 text-sm bg-[#0d1117] border border-[#30363d] rounded focus:outline-none focus:border-blue-500" />
               </div>
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium mb-1 text-white">RBAC Role Assignment</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full p-2 bg-[#0d1117] border border-[#30363d] rounded text-white focus:outline-none focus:border-blue-500">
                <option value="Admin">Security Admin (Full Access + SOAR)</option>
                <option value="Analyst">Security Analyst (Read-Only)</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition-colors cursor-pointer mt-4">
              Authenticate & Launch Multi-Cloud
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4 text-center">Credentials securely vaulted in OS Keyring.</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <>
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">Executive Summary (AWS + Azure + GCP)</h2>
               <div className="flex gap-2">
                 <button onClick={exportBenchmarkReport} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-semibold transition-colors shadow-[0_0_8px_rgba(255,255,255,0.1)] cursor-pointer">
                   Export Benchmark Report
                 </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-sm">
                <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-2">Logs Ingested</h3>
                <p className="text-3xl font-bold">{logs.length}</p>
              </div>
              <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-sm">
                <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-2">Open Alerts</h3>
                <p className="text-3xl font-bold text-red-400">{alerts.length}</p>
              </div>
              <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-sm">
                <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-2">Anomalies</h3>
                <p className="text-3xl font-bold text-orange-400">{anomalies.length}</p>
              </div>
              <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-sm">
                <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-2">Failed Posture Checks</h3>
                <p className="text-3xl font-bold text-yellow-400">{cspmFindings.filter(f => f.status === 'FAIL').length}</p>
              </div>
            </div>
            
            <div className="flex gap-4 mb-8">
              <button onClick={runIngestion} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-sm font-semibold transition-colors cursor-pointer">Fetch Real CloudTrail Logs</button>
              <button onClick={runSimulation} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)] cursor-pointer">Inject Red Team Synthetic Data (Multi-Cloud)</button>
            </div>
          </>
        );
      case 'Threat Graph':
        return (
          <div className="h-full w-full bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden relative">
            <div className="absolute top-4 left-4 z-10 bg-[#161b22]/90 p-3 rounded border border-[#30363d] text-sm">
              <h4 className="font-bold mb-2">Legend</h4>
              <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Malicious IPs</div>
              <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-orange-500"></div> Triggered Rules</div>
              <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Anomalies</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Cloud Providers</div>
            </div>
            <ForceGraph2D
              graphData={graphData}
              nodeLabel="name"
              nodeColor={node => {
                if (node.group === 1) return '#ef4444'; // IP
                if (node.group === 2) return '#f97316'; // Rule
                if (node.group === 3) return '#eab308'; // Anomaly
                return '#a855f7'; // Cloud Provider
              }}
              linkColor={() => '#30363d'}
              backgroundColor="#0d1117"
              nodeRelSize={6}
              linkWidth={2}
            />
          </div>
        );
      case 'Log Explorer':
        return (
          <div>
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={dslQuery} 
                onChange={(e) => setDslQuery(e.target.value)} 
                placeholder='e.g., cloud_provider:"Azure" source_ip:"192.168.1.1"' 
                className="flex-1 p-2 bg-[#161b22] border border-[#30363d] rounded text-white focus:border-blue-500 outline-none font-mono text-sm"
              />
              <button onClick={fetchLogs} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-medium cursor-pointer">Run DSL Query</button>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-[#0d1117] text-xs uppercase border-b border-[#30363d]">
                    <tr>
                      <th className="px-4 py-3">Cloud</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Activity</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Source IP</th>
                      <th className="px-4 py-3">Service</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <tr key={idx} className="border-b border-[#30363d] hover:bg-[#30363d]/50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.cloud_provider === 'AWS' ? 'bg-orange-600 text-white' : log.cloud_provider === 'Azure' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                            {log.cloud_provider || 'AWS'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{log.event_time}</td>
                        <td className="px-4 py-3 text-blue-300">{log.activity_name}</td>
                        <td className="px-4 py-3">{log.user_identity}</td>
                        <td className="px-4 py-3 font-mono text-xs">{log.source_ip}</td>
                        <td className="px-4 py-3 text-gray-400">{log.api_service_name}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No logs match query</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'Alert Triage':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">Correlated Security Alerts (Multi-Cloud)</h3>
              <div className="grid gap-4">
                {alerts.map(alert => (
                  <div key={alert.id} className="p-4 bg-[#161b22] border border-red-900/50 rounded-lg shadow-sm flex items-start gap-4">
                    <div className={`px-2 py-1 rounded text-xs font-bold ${alert.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'}`}>
                      {alert.severity}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-md font-semibold text-white">{alert.rule_name}</h4>
                      <p className="text-sm text-gray-400 mt-1">{alert.description}</p>
                      <div className="flex gap-4 mt-3 text-xs text-gray-500">
                        <span><strong className="text-gray-300">IP:</strong> {alert.source_ip}</span>
                        <span><strong className="text-gray-300">Tactic:</strong> {alert.mitre_tactic}</span>
                        <span><strong className="text-gray-300">Technique:</strong> <span className="px-2 py-0.5 bg-[#30363d] rounded text-blue-300">{alert.mitre_technique}</span></span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{alert.time}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Statistical Volumetric Anomalies</h3>
              <div className="grid gap-4">
                {anomalies.map((anom, idx) => (
                  <div key={idx} className="p-4 bg-[#161b22] border border-orange-900/50 rounded-lg shadow-sm">
                    <h4 className="text-md font-semibold text-white">{anom.anomaly_type}</h4>
                    <p className="text-sm text-gray-400 mt-1">{anom.description}</p>
                    <div className="mt-2 font-mono text-xs text-orange-300">Offending IP: {anom.source_ip} (Total Events: {anom.event_count})</div>
                  </div>
                ))}
                {anomalies.length === 0 && (
                  <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-gray-400">No anomalies detected. Run Stratus Red Team simulation to generate anomalies.</div>
                )}
              </div>
            </div>
          </div>
        );
      case 'CSPM Posture':
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Cloud Posture & Auto-Remediation (SOAR)</h3>
              <button onClick={fetchCspm} className="text-sm text-blue-400 hover:text-blue-300">Refresh Scan</button>
            </div>
            <div className="grid gap-4">
              {cspmFindings.map(finding => (
                <div key={finding.rule_id} className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${finding.severity === 'CRITICAL' ? 'bg-red-900 text-red-200' : finding.severity === 'HIGH' ? 'bg-orange-900 text-orange-200' : 'bg-yellow-900 text-yellow-200'}`}>
                        {finding.severity}
                      </span>
                      <h4 className="font-semibold text-white">{finding.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs border ${finding.status === 'FAIL' ? 'border-red-500 text-red-500' : 'border-green-500 text-green-500'}`}>{finding.status}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">{finding.description}</p>
                    <p className="text-xs font-mono text-gray-500 mt-2">Resource: {finding.resource}</p>
                  </div>
                  
                  {finding.rule_id === 'S3.1' && finding.status === 'FAIL' && (
                    <button 
                      onClick={() => remediateS3(finding.resource)}
                      className={`ml-4 px-4 py-2 rounded text-sm font-semibold transition-colors shadow-[0_0_10px_rgba(147,51,234,0.3)] cursor-pointer ${role === 'Admin' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                      disabled={role !== 'Admin'}
                    >
                      {role === 'Admin' ? 'Auto-Remediate (SOAR)' : 'Admin Required (RBAC)'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col">
        <div className="p-4 border-b border-[#30363d]">
          <h1 className="font-bold text-xl tracking-tight text-blue-400">Antigravity SIEM</h1>
          <div className="mt-2 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> 
            Role: <span className="font-bold text-white">{role}</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {['Dashboard', 'Threat Graph', 'Log Explorer', 'Alert Triage', 'CSPM Posture'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left block p-2 rounded transition-colors cursor-pointer ${activeTab === tab ? 'bg-blue-600/20 text-blue-400 font-medium border-l-4 border-blue-500' : 'hover:bg-[#30363d] text-gray-400 hover:text-white border-l-4 border-transparent'}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-[#30363d] flex items-center px-6 bg-[#0d1117]">
          <h2 className="font-semibold text-lg">{activeTab}</h2>
        </div>
        <div className="p-6 flex-1 overflow-auto">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
