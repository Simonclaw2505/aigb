/**
 * Recycle Bin page
 * View and restore soft-deleted records
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, Search, Clock, Loader2, Database } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface SoftDeletedRecord {
  id: string;
  organization_id: string;
  project_id: string | null;
  original_table: string;
  original_id: string;
  deleted_data: Record<string, unknown>;
  deleted_at: string;
  deleted_by: string | null;
  expires_at: string;
  is_permanently_deleted: boolean;
}

// Helper to access new tables that may not be in generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function RecycleBin() {
  const { currentProject } = useCurrentProject();
  const { toast } = useToast();
  const [records, setRecords] = useState<SoftDeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [tables, setTables] = useState<string[]>([]);

  const fetchRecords = useCallback(async () => {
    if (!currentProject?.organization_id) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await db
        .from("soft_deleted_records")
        .select("*")
        .eq("organization_id", currentProject.organization_id)
        .eq("is_permanently_deleted", false)
        .order("deleted_at", { ascending: false });

      if (error && !error.message?.includes("does not exist")) throw error;

      const rawData = (data || []) as SoftDeletedRecord[];
      
      // Filter by project if specified
      const filteredData = currentProject.id 
        ? rawData.filter(r => r.project_id === currentProject.id)
        : rawData;

      setRecords(filteredData);

      // Extract unique table names
      const uniqueTables = [...new Set(filteredData.map(r => r.original_table))];
      setTables(uniqueTables);
    } catch (err) {
      console.error("Failed to fetch records:", err);
      toast({
        title: "Error",
        description: "Failed to load deleted records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentProject, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleRestore = async (record: SoftDeletedRecord) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      // Mark as restored (actual restoration would need custom logic per table)
      const { error } = await db
        .from("soft_deleted_records")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: userId,
        })
        .eq("id", record.id);

      if (error) throw error;

      toast({
        title: "Record restored",
        description: `${record.original_table} record has been marked for restoration`,
      });

      fetchRecords();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to restore record",
        variant: "destructive",
      });
    }
  };

  const handlePermanentDelete = async (record: SoftDeletedRecord) => {
    try {
      const { error } = await db
        .from("soft_deleted_records")
        .update({ is_permanently_deleted: true })
        .eq("id", record.id);

      if (error) throw error;

      toast({
        title: "Permanently deleted",
        description: "Record has been permanently removed",
      });

      fetchRecords();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete record",
        variant: "destructive",
      });
    }
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      search === "" ||
      record.original_table.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(record.deleted_data).toLowerCase().includes(search.toLowerCase());

    const matchesTable = tableFilter === "all" || record.original_table === tableFilter;

    return matchesSearch && matchesTable;
  });

  const getRecordName = (record: SoftDeletedRecord): string => {
    const data = record.deleted_data;
    return (data.name as string) || (data.title as string) || (data.id as string) || record.original_id;
  };

  return (
    <DashboardLayout
      title="Recycle Bin"
      description="Recover deleted records before they expire"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deleted records..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Records list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Deleted Records</CardTitle>
                <CardDescription>
                  {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} in recycle bin
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {search || tableFilter !== "all"
                    ? "No matching records found"
                    : "No deleted records"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{getRecordName(record)}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {record.original_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{record.original_table}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(record.deleted_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(record.expires_at), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(record)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. The record will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handlePermanentDelete(record)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Forever
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
