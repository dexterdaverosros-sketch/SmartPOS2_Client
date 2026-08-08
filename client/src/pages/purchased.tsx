import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Plus, X, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PurchaseService } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import type { Purchase } from "@shared/schema";
import { format } from "date-fns";

// Temporary type for product being added in the form
interface TempProduct {
  id: string;
  name: string;
  cost: number;
  quantity: number;
  details: string;
  expirationDate: string;
}

export default function PurchasedPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  
  // Purchase Header State
  const [supplierName, setSupplierName] = useState("");
  const [description, setDescription] = useState("");
  const [datePurchased, setDatePurchased] = useState(new Date().toISOString().split('T')[0]);

  // Product Form State
  const [productName, setProductName] = useState("");
  const [productCost, setProductCost] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [productDetails, setProductDetails] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  const [addedProducts, setAddedProducts] = useState<TempProduct[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      const data = await PurchaseService.getAllPurchases();
      setPurchases(data);
    } catch (error) {
      console.error("Failed to load purchases", error);
    }
  };

  const handleAddProduct = () => {
    if (!productName || !productCost) {
      toast({
        title: "Missing Fields",
        description: "Product Name and Cost are required.",
        variant: "destructive",
      });
      return;
    }

    const newProduct: TempProduct = {
      id: Math.random().toString(36).substr(2, 9),
      name: productName,
      cost: parseFloat(productCost),
      quantity: parseInt(productQuantity) || 1,
      details: productDetails,
      expirationDate: expirationDate
    };

    setAddedProducts([...addedProducts, newProduct]);
    resetProductForm();
    setIsAddProductOpen(false);
  };

  const resetProductForm = () => {
    setProductName("");
    setProductCost("");
    setProductQuantity("1");
    setProductDetails("");
    setExpirationDate("");
  };

  const resetPurchaseForm = () => {
    setSupplierName("");
    setDescription("");
    setDatePurchased(new Date().toISOString().split('T')[0]);
    setAddedProducts([]);
    resetProductForm();
  };

  const handleSavePurchase = async () => {
    if (addedProducts.length === 0) {
      toast({
        title: "No Products",
        description: "Please add at least one product.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save each product as a purchase record
      // Note: This matches the current schema where each row is a purchase/product
      for (const prod of addedProducts) {
        await PurchaseService.addPurchase({
          tenantId: '',
          productName: prod.name,
          quantity: prod.quantity,
          cost: prod.cost,
          supplier: supplierName,
          date: new Date(datePurchased),
          description: description,
          details: prod.details,
          expirationDate: prod.expirationDate ? new Date(prod.expirationDate) : null,
        });
      }

      toast({
        title: "Success",
        description: "Purchase saved successfully.",
      });

      setIsAddPurchaseOpen(false);
      resetPurchaseForm();
      loadPurchases();
    } catch (error) {
      console.error("Error saving purchase:", error);
      toast({
        title: "Error",
        description: "Failed to save purchase.",
        variant: "destructive",
      });
    }
  };

  const removeProduct = (id: string) => {
    setAddedProducts(addedProducts.filter(p => p.id !== id));
  };

  return (
    <Layout>
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative">
        <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="flex items-center mb-4">
            <button
              onClick={() => setLocation('/admin-main')}
              className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Purchased
            </h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search purchases..." 
              className="pl-10 bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 flex-1 overflow-auto">
           {/* List of Purchases */}
           <div className="space-y-4">
            {purchases
              .filter(p => 
                p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((purchase) => (
              <div key={purchase.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{purchase.productName}</h3>
                    <p className="text-sm text-gray-500">{purchase.supplier || 'No Supplier'}</p>
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(purchase.date), 'MMM dd, yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-600">₱{purchase.cost.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Qty: {purchase.quantity}</p>
                  </div>
                </div>
                {purchase.description && (
                   <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-300">{purchase.description}</p>
                   </div>
                )}
              </div>
            ))}
            
            {purchases.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    No purchases found.
                </div>
            )}
           </div>
        </div>

        {/* Floating Add Button */}
        <button
            onClick={() => setIsAddPurchaseOpen(true)}
            className="fixed bottom-24 right-6 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10"
        >
            <Plus className="w-6 h-6" />
        </button>

        {/* Add Purchase Dialog */}
        <Dialog open={isAddPurchaseOpen} onOpenChange={setIsAddPurchaseOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center">
                <span>Add Purchase</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Supplier Name</Label>
                        <Input 
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            placeholder="Enter supplier name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Date Purchased</Label>
                        <div className="relative">
                            <Input 
                                type="date"
                                value={datePurchased}
                                onChange={(e) => setDatePurchased(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Purchase description..."
                    />
                </div>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Products</span>
                    </div>
                </div>

                <Button 
                    variant="outline" 
                    className="w-full border-dashed"
                    onClick={() => setIsAddProductOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product Purchased
                </Button>

                {/* List of Added Products in Form */}
                <div className="space-y-3 mt-4">
                    {addedProducts.map((prod) => (
                        <div key={prod.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div>
                                <h4 className="font-medium">{prod.name}</h4>
                                <p className="text-sm text-gray-500">{prod.details}</p>
                                <div className="flex gap-2 text-xs text-gray-400 mt-1">
                                    <span>Qty: {prod.quantity}</span>
                                    {prod.expirationDate && <span>Exp: {prod.expirationDate}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-purple-600">₱{prod.cost.toFixed(2)}</span>
                                <button 
                                    onClick={() => removeProduct(prod.id)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsAddPurchaseOpen(false)}>Cancel</Button>
                <Button onClick={handleSavePurchase}>Save Purchase</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Product Sub-Dialog */}
        <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Product Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Product Name</Label>
                        <Input 
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="Product name"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cost</Label>
                            <Input 
                                type="number"
                                value={productCost}
                                onChange={(e) => setProductCost(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input 
                                type="number"
                                value={productQuantity}
                                onChange={(e) => setProductQuantity(e.target.value)}
                                placeholder="1"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Details</Label>
                        <Input 
                            value={productDetails}
                            onChange={(e) => setProductDetails(e.target.value)}
                            placeholder="Size, color, etc."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Expiration Date</Label>
                        <Input 
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddProduct}>Add Product</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
}

