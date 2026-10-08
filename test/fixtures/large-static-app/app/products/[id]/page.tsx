export async function generateStaticParams() {
  const res = await fetch("https://api.example.com/products");
  const products = await res.json();
  return products.map((p: { id: string }) => ({ id: p.id }));
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return <h1>Product {params.id}</h1>;
}
