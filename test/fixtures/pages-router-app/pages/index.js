export async function getStaticProps() {
  return { props: { now: Date.now() }, revalidate: 60 };
}

export default function Home({ now }) {
  return <h1>Home {now}</h1>;
}
