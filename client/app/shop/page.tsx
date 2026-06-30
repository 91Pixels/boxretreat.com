import { createClient } from '@/lib/supabase/server';
import { ShopClient } from './ShopClient';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';

export interface Product {
  id: string;
  name: string;
  category: string;
  sell_price: number;
  stock: number;
}

async function fetchProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, category, sell_price, stock')
      .eq('active', true)
      .order('sell_price');
    return data ?? [];
  } catch {
    // Fallback products if Supabase not connected
    return [
      { id: 'PROD-WAX',    name: 'Surf Wax (3-pack)',      category: 'surf',    sell_price: 15, stock: 30 },
      { id: 'PROD-SHIRT',  name: 'BoxRetreat T-Shirt',     category: 'apparel', sell_price: 28, stock: 50 },
      { id: 'PROD-TOTE',   name: 'Beach Tote Bag',         category: 'apparel', sell_price: 22, stock: 20 },
      { id: 'PROD-SNORKEL',name: 'Snorkel Set',            category: 'water',   sell_price: 45, stock: 10 },
      { id: 'PROD-CAP',    name: 'BoxRetreat Cap',         category: 'apparel', sell_price: 24, stock: 25 },
      { id: 'PROD-BOARD',  name: 'Surfboard (day rental)', category: 'surf',    sell_price: 35, stock: 3  },
    ];
  }
}

export default async function ShopPage() {
  const products = await fetchProducts();
  return (
    <>
      <Nav />
      <ShopClient products={products} />
      <Footer />
    </>
  );
}
