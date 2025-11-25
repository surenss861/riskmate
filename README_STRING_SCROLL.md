# StringTune Integration Guide

## Setup

1. **Library is loaded automatically** from unpkg CDN:
   ```html
   <script src="https://unpkg.com/@fiddle-digital/string-tune@1.1.29/dist/index.js"></script>
   ```

   Or set custom URL via environment variable:
   ```env
   NEXT_PUBLIC_STRING_TUNE_URL=/path/to/string-tune/index.js
   ```

2. **The library is automatically initialized** via `StringScrollProvider` component.

## Usage in Components

Add `string` or `data-string-*` attributes to elements you want to animate:

```tsx
// Parallax effect (moves slower/faster than scroll)
<div string string-parallax="-0.4">
  Content moves slower than scroll
</div>

// Progress-based animation (CSS variable driven)
<div string string-progress>
  Opacity and transform based on scroll progress
</div>

// Show/hide on scroll (adds -inview class)
<div string string-show>
  Fades in when entering viewport
</div>

// Lazy-loaded images
<img string string-lazy="https://example.com/image.jpg" />
```

## Available Attributes

- `string` or `data-string` - Base attribute to enable StringTune
- `string-parallax="0.5"` - Parallax speed (negative = slower, positive = faster)
- `string-progress` - Exposes `--string-progress` CSS variable (0 to 1)
- `string-show` - Adds `.-inview` class when element enters viewport
- `string-lazy="url"` - Lazy loads image when entering viewport
- `string-repeat` - Repeats animation on scroll (for infinite scroll effects)

## CSS Variables

Elements with `string-progress` expose:
- `--string-progress`: 0 (top) to 1 (bottom)

Use in CSS:
```css
[string-progress] {
  opacity: calc(0.3 + var(--string-progress));
  transform: translateY(calc((1 - var(--string-progress)) * 30px));
}
```

## CSS Classes

- `.-inview` - Added when element enters viewport (for `string-show` and `string-lazy`)

## API Usage (Advanced)

```tsx
import { useStringScroll } from '@/lib/useStringScroll'

function MyComponent() {
  const instance = useStringScroll()
  
  // Scroll to position
  instance?.scrollTo(500)
  
  // Listen to events
  useEffect(() => {
    if (!instance) return
    
    const handler = (data: any) => {
      console.log('Scroll progress:', data)
    }
    
    instance.on('progress', handler)
    return () => instance.off('progress', handler)
  }, [instance])
}
```

## Current Implementation

The landing page (`app/page.tsx`) uses:
- Hero section: Parallax and progress animations
- How It Works: Parallax + show animations
- Pricing: Show animation on scroll

All animations are hardware-accelerated and smooth.

## Performance Tips

- Use CSS variables for GPU-accelerated transforms
- Disable smooth scroll on mobile (handled automatically)
- Use `string-lazy` for images to reduce initial load
- Enable `StringTracker` in development to monitor FPS

