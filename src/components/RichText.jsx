// Renders the small subset of markdown the tutor uses: **bold**, *italics* and "- " bullets.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function RichText({ text }) {
  const blocks = [];
  let list = null;

  text.split('\n').forEach((line, i) => {
    line = line.trimEnd();
    if (line.startsWith('- ')) {
      if (!list) {
        list = [];
        blocks.push({ type: 'ul', key: i, items: list });
      }
      list.push(<li key={i}>{inline(line.slice(2))}</li>);
    } else {
      list = null;
      if (line.trim()) blocks.push({ type: 'p', key: i, content: inline(line) });
    }
  });

  return (
    <div className="rich">
      {blocks.map((b) => (b.type === 'ul' ? <ul key={b.key}>{b.items}</ul> : <p key={b.key}>{b.content}</p>))}
    </div>
  );
}
