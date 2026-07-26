import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { fetchLiveTables, clearLiveCases } from "@/lib/catalyst-api";
import {
  Database, RefreshCcw, Table, Layers, Search, ShieldCheck, CheckCircle2,
  Trash2, ExternalLink, ArrowRight, Info, Plus, Sparkles, Filter, Server
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/zoho-console")({
  head: () => ({
    meta: [
      { title: "Zoho Console Datastore · 27 Tables Live Explorer" },
      { name: "description", content: "Interactive Zoho Catalyst Data Store console tracking all 27 database tables." },
    ],
  }),
  component: ZohoConsolePage,
});

function ZohoConsolePage() {
  const [tables, setTables] = useState<any[]>([]);
  const [tablesData, setTablesData] = useState<Record<string, any[]>>({});
  const [selectedTableName, setSelectedTableName] = useState<string>("CaseMaster");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const res = await fetchLiveTables();
      setTables(res.tables || []);
      setTablesData(res.data || {});
    } catch (err: any) {
      toast.error(`Failed to connect to Zoho Console API: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTables();

    const handleUpdate = () => {
      loadTables();
    };

    window.addEventListener("zoho-table-update", handleUpdate);
    window.addEventListener("db-update", handleUpdate);

    return () => {
      window.removeEventListener("zoho-table-update", handleUpdate);
      window.removeEventListener("db-update", handleUpdate);
    };
  }, []);

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all data in all 27 Zoho Console tables?")) {
      setIsClearing(true);
      try {
        await clearLiveCases();
        await loadTables();
        toast.success("All 27 tables in Zoho Console Datastore cleared successfully.");
      } catch (err: any) {
        toast.error(`Clear failed: ${err.message}`);
      } finally {
        setIsClearing(false);
      }
    }
  };

  const selectedTableMeta = useMemo(() => {
    return tables.find((t) => t.name === selectedTableName) || tables[0] || { name: selectedTableName, id: "50989000000028030", columns: [] };
  }, [tables, selectedTableName]);

  const rawRows = useMemo(() => {
    return tablesData[selectedTableName] || [];
  }, [tablesData, selectedTableName]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rawRows;
    const term = searchTerm.toLowerCase();
    return rawRows.filter((row) =>
      Object.values(row).some((val) => String(val ?? "").toLowerCase().includes(term))
    );
  }, [rawRows, searchTerm]);

  const totalRecordCount = useMemo(() => {
    return Object.values(tablesData).reduce((sum, rows) => sum + (rows?.length || 0), 0);
  }, [tablesData]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="§ ZOHO-01"
        eyebrow="Karnataka Police · Catalyst Datastore"
        title="Zoho Console & Data Store Explorer"
        description="Live multi-table console tracking all 27 tables from ksp.pdf. Data entered in New FIR reflects here instantly."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={loadTables}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="h-8 text-xs border-border bg-surface-1 hover:bg-surface-2"
            >
              <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Console
            </Button>
            <Link to="/cases/new">
              <Button size="sm" className="h-8 text-xs bg-signal text-primary-foreground hover:bg-signal/90 font-medium">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Register New FIR
              </Button>
            </Link>
            <Button
              onClick={handleClearAll}
              variant="destructive"
              size="sm"
              disabled={isClearing}
              className="h-8 text-xs"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear 27 Tables
            </Button>
          </div>
        }
      />

      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-surface-1 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Total Zoho Tables</div>
              <div className="text-2xl font-bold font-mono mt-1 text-foreground flex items-baseline gap-2">
                27 <span className="text-xs text-signal font-normal font-sans">ksp.pdf Schema</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-signal/10 border border-signal/30 text-signal">
              <Table className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Total Records Stored</div>
              <div className="text-2xl font-bold font-mono mt-1 text-foreground">
                {totalRecordCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Catalyst Connection</div>
              <div className="text-sm font-semibold font-mono mt-1 text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Active & Live
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Instant Reflection</div>
              <div className="text-xs font-mono mt-1 text-muted-foreground">
                Auto-synced on FIR Submit
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Console Explorer Grid */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Table Selector List (Left 4 Cols) */}
        <Card className="md:col-span-4 bg-surface-1 border-border flex flex-col h-[750px]">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-signal" />
                Zoho Console Tables (27)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] border-signal/40 text-signal">
                ksp.pdf
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Select any table to view stored rows & column definitions.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1 divide-y divide-border/20">
            {tables.map((t) => {
              const isSelected = t.name === selectedTableName;
              const count = (tablesData[t.name] || []).length;
              return (
                <button
                  key={t.name}
                  onClick={() => setSelectedTableName(t.name)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-all flex items-center justify-between group ${
                    isSelected
                      ? "bg-paper text-ink font-semibold border border-ink shadow-sm"
                      : "text-foreground hover:bg-surface-2"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-mono text-[13px] truncate flex items-center gap-1.5">
                      <Table className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-signal" : "text-muted-foreground"}`} />
                      <span>{t.name}</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate opacity-75 mt-0.5">
                      ID: {t.id}
                    </div>
                  </div>
                  <Badge
                    variant={count > 0 ? "default" : "secondary"}
                    className={`font-mono text-[10px] shrink-0 ${
                      count > 0 ? "bg-signal text-primary-foreground" : "bg-surface-3 text-muted-foreground"
                    }`}
                  >
                    {count} rows
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Selected Table Data & Schema Panel (Right 8 Cols) */}
        <div className="md:col-span-8 space-y-6">
          {/* Table Header & Search */}
          <Card className="bg-surface-1 border-border">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
                      <Table className="h-5 w-5 text-signal" />
                      {selectedTableName}
                    </h2>
                    <Badge variant="outline" className="font-mono text-xs border-signal/40 text-signal">
                      ID: {selectedTableMeta.id}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Showing stored records from Zoho Catalyst Datastore for <span className="font-semibold text-foreground">{selectedTableName}</span>
                  </p>
                </div>

                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${selectedTableName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs bg-surface-2 border-border"
                  />
                </div>
              </div>
            </CardHeader>

            {/* Schema Column Reference Chips */}
            <CardContent className="p-4 border-b border-border/40 bg-surface-2/40">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-signal" />
                Schema Columns from ksp.pdf ({selectedTableMeta.columns?.length || 0})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTableMeta.columns?.map((col: any) => (
                  <Badge
                    key={col.id || col.name}
                    variant="outline"
                    className="font-mono text-[10px] bg-background border-border text-foreground py-0.5 px-2"
                  >
                    <span className="font-semibold text-signal">{col.name}</span>
                    <span className="text-muted-foreground ml-1">({col.type})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>

            {/* Live Data Grid */}
            <CardContent className="p-0 overflow-x-auto min-h-[450px]">
              {isLoading ? (
                <div className="p-12 text-center text-muted-foreground font-mono text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCcw className="h-6 w-6 animate-spin text-signal" />
                  Fetching live table rows from Zoho Catalyst...
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-mono text-xs flex flex-col items-center justify-center gap-3">
                  <Info className="h-8 w-8 text-muted-foreground/50" />
                  <div>
                    <div className="font-semibold text-foreground text-sm">No records stored in {selectedTableName} yet</div>
                    <div className="text-muted-foreground text-xs mt-1">
                      Register a New FIR on the <Link to="/cases/new" className="text-signal underline font-medium">New FIR Page</Link> to write data to all 27 tables instantly.
                    </div>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/80 text-muted-foreground font-mono text-[11px] uppercase">
                      <th className="p-3">#</th>
                      {Object.keys(filteredRows[0] || {}).map((key) => (
                        <th key={key} className="p-3 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={row.ROWID || row.CaseMasterID || idx}
                        className="hover:bg-surface-2/50 transition-colors group"
                      >
                        <td className="p-3 text-muted-foreground text-[11px] font-semibold">{idx + 1}</td>
                        {Object.entries(row).map(([k, val], vIdx) => (
                          <td key={vIdx} className="p-3 whitespace-nowrap text-foreground max-w-xs truncate">
                            {typeof val === "object" && val !== null ? (
                              <span className="text-xs text-signal font-sans">{JSON.stringify(val)}</span>
                            ) : k === "CrimeNo" || k === "CaseMasterID" || k === "ROWID" ? (
                              <span className="font-bold text-signal">{String(val)}</span>
                            ) : (
                              String(val ?? "—")
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
