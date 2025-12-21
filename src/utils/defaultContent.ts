export const DEFAULT_CONTENT = `# Markdown & Mermaid Example

This is a comprehensive example document showcasing Markdown and Mermaid diagrams.

## 📝 Markdown Syntax Demo

### Heading Levels
This is a Level 3 heading. Markdown supports six levels of headings.

### Text Formatting
- **Bold text**
- *Italic text*
- ~~Strikethrough~~
- \`Inline code\`

### Lists

#### Unordered List
- Item 1
- Item 2
  - Sub-item 2.1
  - Sub-item 2.2
- Item 3

#### Ordered List
1. First item
2. Second item
3. Third item

### Links and Images
[Link Text](https://example.com)

### Code Blocks

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
\`\`\`

### Blockquotes
> This is a blockquote.
> It can contain multiple lines of text.

---

## 📊 Mermaid Diagram Demo

### Flowchart

\`\`\`mermaid
graph TD
    A[Start] --> B{Condition}
    B -->|Yes| C[Action A]
    B -->|No| D[Action B]
    C --> E[End]
    D --> E
\`\`\`

### Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Send Request
    Frontend->>Backend: API Call
    Backend->>Database: Query Data
    Database-->>Backend: Return Result
    Backend-->>Frontend: JSON Response
    Frontend-->>User: Display Data
\`\`\`

### Gantt Chart

\`\`\`mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Requirements Analysis :a1, 2024-01-01, 7d
    System Design         :a2, after a1, 5d
    section Phase 2
    Development           :b1, after a2, 14d
    Testing               :b2, after b1, 7d
\`\`\`

---

## 🎉 Getting Started

1. Edit the Markdown content on the left
2. See the rendered output in real-time on the right
3. Manage multiple documents using tabs
4. Content is automatically saved to your browser

Enjoy writing! ✨
`
