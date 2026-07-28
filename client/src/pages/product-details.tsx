import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Image as ImageIcon, Edit, Package, AlertTriangle, Barcode, Tag, Layers, DollarSign, Database } from 'lucide-react';
import { ProductService } from '@/lib/db';
import type { Product, Variant } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default function ProductDetails() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/inventory/product/:id');
  const id = match ? params?.id : undefined;
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [invalidId, setInvalidId] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setNotFound(false);
      setInvalidId(false);

      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        setInvalidId(true);
        setLoading(false);
        return;
      }

      if (id.length >= 20 && !UUID_REGEX.test(id) && !id.startsWith('prod_')) {
        // IDs might be UUIDs or custom format; warn but allow lookup for legacy short IDs
      }

      const p = await ProductService.getProductById(id);
      if (!p) {
        setProduct(undefined);
        setNotFound(true);
        setVariants([]);
      } else {
        setProduct(p);
        try {
          const vs = await ProductService.getVariants(id);
          setVariants(Array.isArray(vs) ? vs : []);
        } catch (err) {
          console.error('Failed to load variants:', err);
          setVariants([]);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  if (!id || invalidId) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-8 text-center shadow-xl rounded-2xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">Invalid Product Reference</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              The product link is missing a valid product identifier. Please go back and try again.
            </p>
            <Button onClick={() => setLocation('/inventory')} className="w-full rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Inventory
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="flex items-center">
            <button
              onClick={() => setLocation('/inventory')}
              className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Skeleton className="h-6 w-40 rounded-md" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Card className="p-4 rounded-xl shadow-lg">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3 rounded-md" />
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-xl shadow">
            <Skeleton className="h-5 w-40 rounded-md mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  if (notFound || !product) {
    return (
      <Layout>
        <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="flex items-center">
            <button
              onClick={() => setLocation('/inventory')}
              className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Product Details</h1>
          </div>
        </div>
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-8 text-center shadow-xl rounded-2xl border-amber-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">Product Not Found</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              We couldn't locate the product you're looking for.
            </p>
            <p className="text-xs text-gray-400 mb-6 font-mono break-all">ID: {String(id)}</p>
            <div className="space-y-2">
              <Button onClick={() => setLocation('/inventory')} className="w-full rounded-xl">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Inventory
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const totalVariantStock = variants.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  const variantStockLabel = product.quantity ? String(product.quantity) : String(totalVariantStock);

  return (
    <Layout>
      <div className="bg-white dark:bg-gray-800 p-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <button
            onClick={() => setLocation('/inventory')}
            className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Product Details</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{product.name}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Product Info Card */}
        <Card className="overflow-hidden rounded-2xl shadow-lg border-0">
          <div className="flex flex-col sm:flex-row items-stretch">
            <div className="sm:w-48 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 p-6 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-700">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-32 h-32 rounded-xl object-cover shadow-sm"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-white dark:bg-gray-700 flex items-center justify-center shadow-inner">
                  <ImageIcon className="w-14 h-14 text-gray-300 dark:text-gray-500" />
                </div>
              )}
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{product.name}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {product.barcode && (
                      <Badge variant="outline" className="gap-1 bg-gray-50 dark:bg-gray-800 rounded-lg border-gray-200 dark:border-gray-700">
                        <Barcode className="w-3 h-3 text-gray-500" />
                        <span className="font-mono text-xs">{product.barcode}</span>
                      </Badge>
                    )}
                    {product.category && (
                      <Badge variant="secondary" className="gap-1 rounded-lg">
                        <Tag className="w-3 h-3" />
                        {product.category}
                      </Badge>
                    )}
                    <Badge className={`rounded-lg gap-1 ${Number(variantStockLabel) > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                      <Database className="w-3 h-3" />
                      {Number(variantStockLabel) > 0 ? `${variantStockLabel} in stock` : 'Out of stock'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">Selling Price</div>
                  <div className="text-3xl font-bold text-[#FF8882]">₱{Number(product.price || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost</div>
                  <div className="font-semibold text-gray-800 dark:text-gray-100">₱{Number((product as any).cost || 0).toFixed(2)}</div>
                </div>
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Base SKU Stock</div>
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{Number(product.quantity || 0)}</div>
                </div>
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Variants</div>
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{variants.length}</div>
                </div>
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Variant Stock</div>
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{totalVariantStock}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Variants Section */}
        <Card className="rounded-2xl shadow border-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <div className="text-base font-semibold text-gray-800 dark:text-gray-100">Product Variants</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {variants.length === 0
                    ? 'No variants configured yet'
                    : `${variants.length} variant${variants.length === 1 ? '' : 's'} • Combined stock: ${totalVariantStock}`}
                </div>
              </div>
            </div>
            <Button
              onClick={() => setLocation(`/inventory/product/${product.id}/variant/add`)}
              className="rounded-xl shadow-sm"
            >
              + Add Variant
            </Button>
          </div>

          <div className="p-5">
            {variants.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Layers className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No variants yet</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
                  Add variants to offer the same product in different sizes, colors, or packaging.
                </p>
                <Button
                  onClick={() => setLocation(`/inventory/product/${product.id}/variant/add`)}
                  variant="secondary"
                  className="rounded-xl"
                >
                  Create First Variant
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {variants.map((v, idx) => {
                  const qty = Number(v.quantity || 0);
                  const lowStock = qty > 0 && qty <= 5;
                  const outOfStock = qty === 0;
                  return (
                    <Card key={v.id} className="rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="flex items-stretch">
                        <div className="w-20 sm:w-24 flex-shrink-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center border-r border-gray-100 dark:border-gray-700">
                          {v.image ? (
                            <img
                              src={v.image}
                              alt={v.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const t = e.currentTarget as HTMLImageElement;
                                t.replaceWith(Object.assign(document.createElement('div'), {
                                  className: 'w-full h-full flex items-center justify-center text-gray-400',
                                  innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                                }));
                              }}
                            />
                          ) : (
                            <div className="text-gray-400 dark:text-gray-500"><ImageIcon className="w-6 h-6" /></div>
                          )}
                        </div>
                        <div className="flex-1 p-4 flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">{v.name}</div>
                              <Badge variant="outline" className="rounded-md text-[10px] font-mono text-gray-500">#{idx + 1}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                              {v.barcode && (
                                <span className="inline-flex items-center gap-1 font-mono">
                                  <Barcode className="w-3 h-3" />{v.barcode}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                Cost ₱{Number(v.cost || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-gray-400 mb-0.5">Price</div>
                              <div className="font-bold text-[#FF8882]">₱{Number(v.price || 0).toFixed(2)}</div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-center min-w-[80px] ${
                              outOfStock ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                                : lowStock ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              <div className="text-[10px] uppercase tracking-wide opacity-75">Stock</div>
                              <div className="font-bold text-sm leading-tight">{qty}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/inventory/product/${product.id}/variant/edit/${v.id}`)}
                              className="rounded-lg h-10 w-10 sm:h-10 sm:w-auto px-2 sm:px-3"
                            >
                              <Edit className="w-4 h-4 sm:mr-1.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
