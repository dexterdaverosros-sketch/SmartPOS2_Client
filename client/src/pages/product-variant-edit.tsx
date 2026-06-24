import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Plus, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { ProductService } from '@/lib/db';

export default function ProductVariantEdit() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/inventory/product/:id/variant/edit/:variantId');
  const productId = match ? params?.id : undefined;
  const variantId = match ? params?.variantId : undefined;

  const [variant, setVariant] = useState('');
  const [price, setPrice] = useState<any>('');
  const [cost, setCost] = useState<any>('');
  const [stock, setStock] = useState<any>('');
  const [barcode, setBarcode] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!variantId) return;
      try {
        const v = await ProductService.getVariantById(variantId);
        if (v) {
          setVariant(v.name);
          setPrice(v.price || '');
          setCost(v.cost || '');
          setStock((v as any).quantity ?? '');
          setBarcode(v.barcode || '');
          setImagePreview(v.image || null);
        }
      } catch (error) {
        console.error('Failed to load variant', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [variantId]);

  const handleSave = async () => {
    if (!productId || !variantId) {
      setLocation('/inventory');
      return;
    }
    await ProductService.updateVariant(variantId, {
      name: variant,
      price: parseFloat(price) || 0,
      cost: parseFloat(cost) || 0,
      quantity: Math.floor(parseFloat(stock)) || 0,
      barcode: barcode || null,
      image: imagePreview,
    });
    setLocation(`/inventory/product/${productId}`);
  };

  if (isLoading) {
     return (
       <Layout>
         <div className="p-4 text-center">Loading variant...</div>
       </Layout>
     );
  }

  return (
    <Layout>
      <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex items-center">
          <button
            onClick={() => setLocation(`/inventory/product/${productId ?? ''}`)}
            className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Edit Variant</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-6 items-start">
          <div className="w-40">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Variant image"
                className="w-40 h-40 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-40 h-40 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600">
                <ImageIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <div className="mt-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setImagePreview(url);
                  }
                }}
                className="border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
          <div className="space-y-3 flex-1 max-w-md">
            <div>
              <label htmlFor="edit-variant-name" className="text-sm text-gray-700 dark:text-gray-300">Variant Name</label>
              <Input
                id="edit-variant-name"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="e.g., 500g, Small, Chocolate"
                className="border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="edit-variant-price" className="text-sm text-gray-700 dark:text-gray-300">Price</label>
              <Input
                id="edit-variant-price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="edit-variant-cost" className="text-sm text-gray-700 dark:text-gray-300">Cost</label>
              <Input
                id="edit-variant-cost"
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="edit-variant-stock" className="text-sm text-gray-700 dark:text-gray-300">Stock Quantity</label>
              <Input
                id="edit-variant-stock"
                type="number"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className="border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="edit-variant-barcode" className="text-sm text-gray-700 dark:text-gray-300">Barcode</label>
              <Input
                id="edit-variant-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="border-gray-300 dark:border-gray-600"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation(`/inventory/product/${productId ?? ''}`)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-[#FF8882] hover:bg-[#D89D9D] text-white">Save</Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
