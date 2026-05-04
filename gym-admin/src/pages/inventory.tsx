import { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type ProductForm = {
  name: string;
  category: string;
  price: string;
  stock: string;
  lowStockThreshold: string;
};
const emptyForm: ProductForm = { name: "", category: "Supplements", price: "", stock: "", lowStockThreshold: "5" };

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading, refetch } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const filtered = (products || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const lowStockItems = (products || []).filter((p) => p.stock <= (p.lowStockThreshold || 5));

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: typeof products extends (infer T)[] | undefined ? T : never) => {
    if (!p) return;
    const prod = p as any;
    setEditId(prod.id);
    setForm({ name: prod.name, category: prod.category || "", price: String(prod.price), stock: String(prod.stock), lowStockThreshold: String(prod.lowStockThreshold || 5) });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast({ title: "Name and price are required", variant: "destructive" }); return; }
    const payload = { 
      name: form.name, 
      category: form.category, 
      price: parseFloat(form.price), 
      stock: parseInt(form.stock || "0"), 
      lowStockThreshold: parseInt(form.lowStockThreshold || "5") 
    };
    try {
      if (editId) { await updateProduct.mutateAsync({ id: editId, data: payload }); toast({ title: "Product updated" }); }
      else { await createProduct.mutateAsync({ data: payload }); toast({ title: "Product added" }); }
      setOpen(false); refetch();
    } catch { toast({ title: "Failed to save product", variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct.mutateAsync({ id: deleteId });
      toast({ title: "Product deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} running low: {lowStockItems.map(p => p.name).join(", ")}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products & Supplements</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No products found</TableCell></TableRow>
                ) : filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category || "—"}</TableCell>
                    <TableCell>PKR {Number(p.price).toLocaleString()}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell>
                      {p.stock <= (p.lowStockThreshold || 5) ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="secondary">In Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Whey Protein 1kg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Supplements" />
              </div>
              <div className="grid gap-2">
                <Label>Price (PKR)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} placeholder="4500" />
              </div>
              <div className="grid gap-2">
                <Label>Stock Quantity</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="20" />
              </div>
              <div className="grid gap-2">
                <Label>Low Stock Alert</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} placeholder="5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>{editId ? "Update" : "Add Product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
