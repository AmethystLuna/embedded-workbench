# LVGL Common Pitfalls

Non-obvious traps when working with LVGL on embedded targets.

## RGB565A8 Custom Decoder Layout

**Pitfall**: Assuming a custom PNG decoder outputs interleaved RGBA pixels.

**Reality**: On 16-bit color depth targets, the decoder separates color and alpha into distinct planes — RGB565 (2 bytes/pixel) for color and A8 (1 byte/pixel) for alpha. Reading as interleaved RGBA produces garbled output.

**Check**: Verify the decoder's output format matches what the draw pipeline expects before writing draw callbacks.

## Alignment Flag Mixing

**Pitfall**: Combining multiple LVGL alignment flags produces unexpected positioning.

**Reality**: LVGL alignment flags are not freely bitwise-combinable. ORing two horizontal flags or two vertical flags produces undefined behavior that depends on internal evaluation order.

**Fix**: Use exactly one horizontal flag ORed with exactly one vertical flag. For non-standard positioning, use `lv_obj_set_pos()` with explicit coordinates after layout.

## Object Cleanup Order and Stale Pointers

**Pitfall**: `lv_obj_clean(parent)` recursively frees children but does not NULL any static pointers that reference those children.

**Fix Pattern**:
```
anim_timer_del();      // 1. Kill async operations
icon = NULL;           // 2. NULL all static pointers
label = NULL;
lv_obj_clean(parent);  // 3. Clean the parent last
```

On page re-entry, always guard with NULL checks before using any cached LVGL object pointer.

## Menu Scroll with Fixed Elements

**Pitfall**: A scrollable menu with header/footer inside the scroll container scrolls those elements along with the content.

**Fix**: Move fixed elements outside the scrollable container:
```
Page (flex column)
├── Header (fixed, outside scroll)
├── Scroll container (flex grow)
│   └── Items (scrollable)
└── Footer (fixed, outside scroll)
```

## Draw Mask Lifecycle

**Pitfall**: Creating an LVGL draw mask and not removing it before the next draw pass causes unrelated elements to be incorrectly masked.

**Fix**: Always pair mask creation with removal:
```
int16_t mask_id = lv_draw_mask_angle_init(&param);
// ... draw ...
lv_draw_mask_remove_id(mask_id);
```

For masks in animation callbacks, store the mask_id and ensure cleanup in the animation's end handler or page exit.

## Alpha Cache Staleness on Overlay Removal

**Pitfall**: Removing a gap/clear overlay from a chart leaves ghost artifacts because the alpha blending cache retains intermediate values.

**Fix**: After removing an overlay, call `lv_obj_invalidate()` on the parent to force a full redraw. For chart widgets, invalidate the entire chart rather than individual series.
