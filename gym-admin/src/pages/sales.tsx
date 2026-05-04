import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Receipt, AlertTriangle,
  User, Tag, CreditCard, Banknote, Smartphone, RotateCcw, X,
  TrendingUp, DollarSign, Clock, AlertCircle, ChevronDown, Printer,
} from "lucide-react";

const API = (path: string) => `/api${path}`;
const headers = (user: any) => ({ "Content-Type": "application/json", "x-admin-email": user?.email || "" });

const fmt = (n: number) => `Rs ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);

type Product = { id: number; name: string; category: string; price: number; stock: number; lowStockThreshold: number };
type CartItem = { productId: number; productName: string; unitPrice: number; quantity: number; maxStock: number };
type Member = { id: number; name: string; phone: string };
type OrderItem = { id: number; productName: string; unitPrice: number; quantity: number; subtotal: number; returned: number };
type Order = {
  id: number; date: string; memberName: string | null; customerName: string | null;
  subtotal: number; discount: number; discountType: string; totalAmount: number;
  paidAmount: number; dueAmount: number; paymentMethod: string; status: string;
  notes: string | null; items: OrderItem[];
};
type Summary = { totalSales: number; totalAmount: number; paidAmount: number; dueAmount: number; cashTotal: number; onlineTotal: number; lowStockCount: number };

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-yellow-100 text-yellow-700 border-yellow-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
  returned: "bg-gray-100 text-gray-600 border-gray-200",
};
const PM_LABELS: Record<string, string> = { cash: "Cash", card: "Card", jazzcash: "JazzCash", easypaisa: "Easypaisa" };
const CATEGORIES = ["All", "Supplements", "Drinks", "Equipment", "Clothing", "Other"];

export default function SalesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const h = headers(user);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Tab ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"pos" | "history">("pos");

  // ── Cart ─────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [showMemberDrop, setShowMemberDrop] = useState(false);
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  // ── Receipt modal ─────────────────────────────────────────────────────────
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // ── Return modal ──────────────────────────────────────────────────────────
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnItemId, setReturnItemId] = useState<number | null>(null);
  const [returnQty, setReturnQty] = useState(1);

  // ── Collect payment modal ─────────────────────────────────────────────────
  const [collectOrder, setCollectOrder] = useState<Order | null>(null);
  const [collectAmount, setCollectAmount] = useState("");

  // ── History filters ───────────────────────────────────────────────────────
  const [histDate, setHistDate] = useState(today());
  const [histStatus, setHistStatus] = useState("all");

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const r = await fetch(API("/pos/products"), { headers: h });
      return r.json();
    },
  });

  const { data: lowStock = [] } = useQuery<Product[]>({
    queryKey: ["pos-low-stock"],
    queryFn: async () => {
      const r = await fetch(API("/pos/products/low-stock"), { headers: h });
      return r.json();
    },
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["pos-members"],
    queryFn: async () => {
      const r = await fetch(API("/pos/members"), { headers: h });
      return r.json();
    },
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["pos-orders", histDate, histStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ date: histDate, status: histStatus });
      const r = await fetch(API(`/pos/orders?${params}`), { headers: h });
      return r.json();
    },
    enabled: tab === "history",
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["pos-summary", histDate],
    queryFn: async () => {
      const r = await fetch(API(`/pos/summary?date=${histDate}`), { headers: h });
      return r.json();
    },
    enabled: tab === "history",
  });

  // ── Filtered products ─────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || p.category === category;
    return matchSearch && matchCat;
  });

  // ── Cart calculations ─────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountNum = parseFloat(discount || "0") || 0;
  const discountAmt = discountType === "percent" ? (subtotal * discountNum / 100) : discountNum;
  const total = Math.max(0, subtotal - discountAmt);
  const paidNum = parseFloat(paidAmount || String(total)) || 0;
  const due = Math.max(0, total - paidNum);
  const payStatus = due <= 0 ? "paid" : paidNum === 0 ? "unpaid" : "partial";

  // Auto-set paid amount to total when total changes
  useEffect(() => { setPaidAmount(String(total.toFixed(0))); }, [total]);

  // ── Cart actions ──────────────────────────────────────────────────────────
  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === p.id);
      if (ex) {
        if (ex.quantity >= p.stock) { toast({ title: "Stock limit reached", variant: "destructive" }); return prev; }
        return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (p.stock === 0) { toast({ title: "Out of stock", variant: "destructive" }); return prev; }
      return [...prev, { productId: p.id, productName: p.name, unitPrice: p.price, quantity: 1, maxStock: p.stock }];
    });
  };

  const updateQty = (productId: number, qty: number) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(qty, i.maxStock)) } : i));
  };

  const removeItem = (productId: number) => setCart(prev => prev.filter(i => i.productId !== productId));
  const clearCart = () => { setCart([]); setDiscount(""); setWalkInName(""); setSelectedMember(null); setMemberSearch(""); setNotes(""); setPaidAmount(""); };

  // ── Create order ──────────────────────────────────────────────────────────
  const createOrder = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");
      const body = {
        memberId: selectedMember?.id || null,
        customerName: selectedMember ? selectedMember.name : walkInName || null,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
        discount: String(discountNum),
        discountType,
        paymentMethod,
        paidAmount: String(paidNum),
        notes,
      };
      const r = await fetch(API("/pos/orders"), { method: "POST", headers: h, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to create order");
      return d;
    },
    onSuccess: async (order) => {
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-low-stock"] });
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      qc.invalidateQueries({ queryKey: ["pos-summary"] });
      // Fetch full order with items for receipt
      const r2 = await fetch(API(`/pos/orders/${order.id}`), { headers: h });
      const full = await r2.json();
      setReceiptOrder(full);
      clearCart();
      toast({ title: "Sale completed!", description: `Order #${order.id} — ${fmt(order.totalAmount)}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Return mutation ───────────────────────────────────────────────────────
  const processReturn = useMutation({
    mutationFn: async () => {
      if (!returnOrder || !returnItemId) throw new Error("No item selected");
      const r = await fetch(API(`/pos/orders/${returnOrder.id}/return`), {
        method: "POST", headers: h, body: JSON.stringify({ itemId: returnItemId, returnQty }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-low-stock"] });
      setReturnOrder(null); setReturnItemId(null); setReturnQty(1);
      toast({ title: "Return processed", description: "Stock has been restocked." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Collect payment ───────────────────────────────────────────────────────
  const collectPayment = useMutation({
    mutationFn: async () => {
      if (!collectOrder) throw new Error("No order");
      const newPaid = Math.min(collectOrder.paidAmount + parseFloat(collectAmount || "0"), collectOrder.totalAmount);
      const r = await fetch(API(`/pos/orders/${collectOrder.id}`), {
        method: "PUT", headers: h, body: JSON.stringify({ paidAmount: String(newPaid) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      qc.invalidateQueries({ queryKey: ["pos-summary"] });
      setCollectOrder(null); setCollectAmount("");
      toast({ title: "Payment recorded successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const memberFiltered = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.phone.includes(memberSearch)
  ).slice(0, 6);

  const handlePrint = () => window.print();

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">POS & Sales</h1>
          <p className="text-sm text-muted-foreground">Point of Sale &amp; Sales Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "pos" ? "default" : "outline"} onClick={() => setTab("pos")} size="sm">
            <ShoppingCart className="h-4 w-4 mr-1" /> New Sale
          </Button>
          <Button variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")} size="sm">
            <Receipt className="h-4 w-4 mr-1" /> Sales History
          </Button>
        </div>
      </div>

      {/* ════════════════════════ POS Terminal ════════════════════════════ */}
      {tab === "pos" && (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Product browser ────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden border-r">
            {/* Low stock alert */}
            {lowStock.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><strong>{lowStock.length}</strong> product(s) low on stock: {lowStock.slice(0, 3).map(p => `${p.name} (${p.stock})`).join(", ")}{lowStock.length > 3 ? "..." : ""}</span>
              </div>
            )}

            {/* Search + category */}
            <div className="p-4 space-y-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${category === c ? "bg-primary text-white border-primary" : "border-input text-muted-foreground hover:border-primary hover:text-primary"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                  <ShoppingCart className="h-8 w-8" />
                  <p className="text-sm">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map(p => {
                    const inCart = cart.find(i => i.productId === p.id);
                    const isLow = p.stock <= p.lowStockThreshold;
                    return (
                      <button key={p.id} onClick={() => addToCart(p)}
                        className={`group text-left rounded-xl border p-3 transition-all hover:shadow-md hover:border-primary ${inCart ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{p.category}</span>
                          {isLow && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                        </div>
                        <p className="font-semibold text-sm leading-tight mb-1 line-clamp-2">{p.name}</p>
                        <p className="text-primary font-bold text-base">{fmt(p.price)}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs ${p.stock === 0 ? "text-destructive" : isLow ? "text-yellow-600" : "text-muted-foreground"}`}>
                            Stock: {p.stock}
                          </span>
                          {inCart && (
                            <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">×{inCart.quantity}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart ─────────────────────────────────────── */}
          <div className="w-[380px] flex flex-col bg-muted/30 overflow-hidden">
            {/* Cart header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="font-semibold">Cart</span>
                {cart.length > 0 && <Badge className="bg-primary text-white text-xs">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>}
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Cart items */}
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                  <ShoppingCart className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Cart is empty — click a product to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-2 bg-card rounded-lg p-2 border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{fmt(item.unitPrice)} each</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => item.quantity <= 1 ? removeItem(item.productId) : updateQty(item.productId, item.quantity - 1)}
                          className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted">
                          {item.quantity <= 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxStock}
                          className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-primary w-16 text-right">{fmt(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <>
                  {/* Customer */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Customer</Label>
                    <div className="relative">
                      <Input placeholder="Search member or type walk-in name..." value={memberSearch || walkInName}
                        onChange={e => {
                          if (selectedMember) { setSelectedMember(null); setMemberSearch(e.target.value); }
                          else if (members.some(m => m.name.toLowerCase().includes(e.target.value.toLowerCase()))) {
                            setMemberSearch(e.target.value); setWalkInName("");
                          } else {
                            setWalkInName(e.target.value); setMemberSearch("");
                          }
                          setShowMemberDrop(true);
                        }}
                        onFocus={() => setShowMemberDrop(true)}
                        className="text-sm pr-8" />
                      {selectedMember && (
                        <button onClick={() => { setSelectedMember(null); setMemberSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      )}
                      {showMemberDrop && memberFiltered.length > 0 && !selectedMember && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
                          {memberFiltered.map(m => (
                            <button key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(m.name); setWalkInName(""); setShowMemberDrop(false); }}
                              className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-primary" />
                              <div><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.phone}</p></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedMember && (
                      <div className="flex items-center gap-2 bg-primary/10 text-primary text-xs px-2 py-1 rounded-md">
                        <User className="h-3 w-3" /> Member: {selectedMember.name} ({selectedMember.phone})
                      </div>
                    )}
                  </div>

                  {/* Discount */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Discount</Label>
                    <div className="flex gap-2">
                      <div className="flex rounded-lg border overflow-hidden">
                        {(["fixed", "percent"] as const).map(t => (
                          <button key={t} onClick={() => setDiscountType(t)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === t ? "bg-primary text-white" : "hover:bg-muted"}`}>
                            {t === "fixed" ? "Rs" : "%"}
                          </button>
                        ))}
                      </div>
                      <Input type="number" min="0" placeholder={discountType === "percent" ? "0-100" : "0"} value={discount}
                        onChange={e => setDiscount(e.target.value)} className="text-sm flex-1" />
                    </div>
                    {discountAmt > 0 && (
                      <p className="text-xs text-green-600">Saving: {fmt(discountAmt)}{discountType === "percent" ? ` (${discountNum}%)` : ""}</p>
                    )}
                  </div>

                  {/* Payment method */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Payment Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "cash", label: "Cash", Icon: Banknote },
                        { id: "card", label: "Card", Icon: CreditCard },
                        { id: "jazzcash", label: "JazzCash", Icon: Smartphone },
                        { id: "easypaisa", label: "Easypaisa", Icon: Smartphone },
                      ].map(({ id, label, Icon }) => (
                        <button key={id} onClick={() => setPaymentMethod(id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-colors ${paymentMethod === id ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/50"}`}>
                          <Icon className="h-4 w-4" /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Paid amount */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount Received</Label>
                    <Input type="number" min="0" max={total} value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)} className="text-sm" />
                    {due > 0 && (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Due: {fmt(due)}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes (optional)</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." className="text-sm" />
                  </div>
                </>
              )}
            </div>

            {/* Order summary + complete */}
            {cart.length > 0 && (
              <div className="border-t bg-card p-4 space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(discountAmt)}</span></div>}
                  <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Total</span><span className="text-primary">{fmt(total)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Paid</span><span className="text-green-600 font-medium">{fmt(paidNum)}</span></div>
                  {due > 0 && <div className="flex justify-between font-medium text-red-600"><span>Due</span><span>{fmt(due)}</span></div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs border ${STATUS_COLORS[payStatus]}`}>{payStatus.toUpperCase()}</Badge>
                  <span className="text-xs text-muted-foreground">{PM_LABELS[paymentMethod]}</span>
                </div>
                <Button className="w-full" size="lg" onClick={() => createOrder.mutate()} disabled={createOrder.isPending}>
                  {createOrder.isPending ? "Processing..." : `Complete Sale — ${fmt(total)}`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════ Sales History ════════════════════════════ */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Sales", value: summary.totalSales, sub: "orders today", Icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
                { label: "Total Revenue", value: fmt(summary.totalAmount), sub: "today", Icon: DollarSign, color: "text-green-600 bg-green-50" },
                { label: "Cash Collected", value: fmt(summary.cashTotal), sub: `Online: ${fmt(summary.onlineTotal)}`, Icon: Banknote, color: "text-purple-600 bg-purple-50" },
                { label: "Outstanding Due", value: fmt(summary.dueAmount), sub: summary.lowStockCount > 0 ? `⚠ ${summary.lowStockCount} low stock` : "All collected", Icon: Clock, color: summary.dueAmount > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50" },
              ].map(({ label, value, sub, Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-bold text-lg leading-tight">{value}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Input type="date" value={histDate} onChange={e => setHistDate(e.target.value)} className="w-40 text-sm" />
            <Select value={histStatus} onValueChange={setHistStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{orders.length} order(s)</span>
          </div>

          {/* Orders table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
                    {["#", "Date", "Customer", "Items", "Subtotal", "Discount", "Total", "Paid", "Due", "Method", "Status", "Actions"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.length === 0 ? (
                    <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">No orders found for this date/filter</td></tr>
                  ) : orders.map(order => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">#{order.id}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{order.date}</td>
                      <td className="px-3 py-2.5 max-w-[140px] truncate">{order.memberName || order.customerName || <span className="text-muted-foreground italic">Walk-in</span>}</td>
                      <td className="px-3 py-2.5">
                        <div className="max-w-[160px]">
                          {order.items.map(i => (
                            <div key={i.id} className="text-xs text-muted-foreground truncate">{i.productName} ×{i.quantity}{i.returned > 0 && <span className="text-red-500"> (-{i.returned})</span>}</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(order.subtotal)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-green-600">{order.discount > 0 ? `-${fmt(order.discount)}` : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{fmt(order.totalAmount)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-green-600 font-medium">{fmt(order.paidAmount)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{order.dueAmount > 0 ? <span className="text-red-600 font-medium">{fmt(order.dueAmount)}</span> : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap capitalize text-xs">{PM_LABELS[order.paymentMethod] || order.paymentMethod}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-xs border ${STATUS_COLORS[order.status]}`}>{order.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => setReceiptOrder(order)} title="Receipt"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Receipt className="h-3.5 w-3.5" /></button>
                          {(order.status === "partial" || order.status === "unpaid") && (
                            <button onClick={() => { setCollectOrder(order); setCollectAmount(String(order.dueAmount)); }} title="Collect payment"
                              className="p-1.5 rounded hover:bg-green-50 text-green-600"><DollarSign className="h-3.5 w-3.5" /></button>
                          )}
                          <button onClick={() => { setReturnOrder(order); setReturnItemId(null); setReturnQty(1); }} title="Return"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><RotateCcw className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════ Receipt Modal ════════════════════════════════════ */}
      {receiptOrder && (
        <Dialog open onOpenChange={() => setReceiptOrder(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Sale Receipt</DialogTitle></DialogHeader>
            <div ref={printRef} className="space-y-4 text-sm print:text-black">
              <div className="text-center border-b pb-3">
                <img src="/images/logo.png" alt="Core X" className="h-12 w-12 object-contain mx-auto mb-1" />
                <p className="font-bold text-base">Core X Gym</p>
                <p className="text-xs text-muted-foreground">Order #{receiptOrder.id}</p>
                <p className="text-xs text-muted-foreground">{receiptOrder.date}</p>
              </div>
              {(receiptOrder.memberName || receiptOrder.customerName) && (
                <div className="text-xs"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{receiptOrder.memberName || receiptOrder.customerName}</span></div>
              )}
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground"><th className="text-left py-1">Item</th><th className="text-center py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Total</th></tr></thead>
                <tbody className="divide-y">
                  {receiptOrder.items.map(i => (
                    <tr key={i.id}><td className="py-1 pr-2">{i.productName}</td><td className="py-1 text-center">{i.quantity}</td><td className="py-1 text-right">{fmt(i.unitPrice)}</td><td className="py-1 text-right font-medium">{fmt(i.subtotal)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t pt-2 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(receiptOrder.subtotal)}</span></div>
                {receiptOrder.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(receiptOrder.discount)}</span></div>}
                <div className="flex justify-between font-bold text-sm"><span>Total</span><span>{fmt(receiptOrder.totalAmount)}</span></div>
                <div className="flex justify-between text-green-600"><span>Paid ({PM_LABELS[receiptOrder.paymentMethod]})</span><span>{fmt(receiptOrder.paidAmount)}</span></div>
                {receiptOrder.dueAmount > 0 && <div className="flex justify-between text-red-600 font-medium"><span>Due</span><span>{fmt(receiptOrder.dueAmount)}</span></div>}
              </div>
              <div className="text-center text-xs text-muted-foreground border-t pt-2">Thank you for your purchase!</div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              {tab === "pos" && <Button size="sm" onClick={() => { setTab("history"); setReceiptOrder(null); }}><Receipt className="h-4 w-4 mr-1" /> View History</Button>}
              <Button variant="outline" size="sm" onClick={() => setReceiptOrder(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ════════════════ Return Modal ════════════════════════════════════ */}
      {returnOrder && (
        <Dialog open onOpenChange={() => setReturnOrder(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle><RotateCcw className="h-4 w-4 inline mr-2" />Return / Refund — Order #{returnOrder.id}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase text-muted-foreground mb-2 block">Select Item to Return</Label>
                <div className="space-y-2">
                  {returnOrder.items.map(i => {
                    const canReturn = i.quantity - i.returned;
                    return (
                      <button key={i.id} disabled={canReturn === 0}
                        onClick={() => { setReturnItemId(i.id); setReturnQty(1); }}
                        className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${returnItemId === i.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"} ${canReturn === 0 ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <div className="flex justify-between">
                          <span className="font-medium">{i.productName}</span>
                          <span className="text-muted-foreground">{fmt(i.unitPrice)} × {i.quantity}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {canReturn > 0 ? `Can return: ${canReturn} units` : "Already fully returned"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {returnItemId && (
                <div>
                  <Label>Return Quantity</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <button onClick={() => setReturnQty(q => Math.max(1, q - 1))} className="h-8 w-8 rounded border flex items-center justify-center hover:bg-muted"><Minus className="h-3 w-3" /></button>
                    <span className="text-lg font-bold w-8 text-center">{returnQty}</span>
                    <button onClick={() => {
                      const item = returnOrder.items.find(i => i.id === returnItemId);
                      if (item) setReturnQty(q => Math.min(item.quantity - item.returned, q + 1));
                    }} className="h-8 w-8 rounded border flex items-center justify-center hover:bg-muted"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnOrder(null)}>Cancel</Button>
              <Button variant="destructive" disabled={!returnItemId || processReturn.isPending}
                onClick={() => processReturn.mutate()}>
                {processReturn.isPending ? "Processing..." : "Process Return"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ════════════════ Collect Payment Modal ══════════════════════════ */}
      {collectOrder && (
        <Dialog open onOpenChange={() => setCollectOrder(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle><DollarSign className="h-4 w-4 inline mr-2" />Collect Payment — Order #{collectOrder.id}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">{fmt(collectOrder.totalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span className="text-green-600">{fmt(collectOrder.paidAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding Due</span><span className="text-red-600 font-bold">{fmt(collectOrder.dueAmount)}</span></div>
              </div>
              <div>
                <Label>Amount to Collect (Rs)</Label>
                <Input type="number" min="1" max={collectOrder.dueAmount} value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCollectOrder(null)}>Cancel</Button>
              <Button disabled={!collectAmount || collectPayment.isPending} onClick={() => collectPayment.mutate()}>
                {collectPayment.isPending ? "Saving..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
