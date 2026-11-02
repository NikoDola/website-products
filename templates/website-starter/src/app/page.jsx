import site from "../content/site.json";
export default function Page() {
  return <><header><a href="/">{site.name}</a><a href="#contact">Contact</a></header><main><p className="eyebrow">{site.name}</p><h1>{site.headline}</h1><p className="intro">{site.intro}</p><section id="contact"><h2>Let's talk.</h2>{site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}{site.phone && <p>{site.phone}</p>}</section></main><footer>{site.name}</footer></>;
}
