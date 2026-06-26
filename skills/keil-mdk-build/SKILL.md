---
name: keil-mdk-build
description: "Use when building, flashing, or packaging firmware with Keil MDK (UV4 CLI, ARMCLANG), analyzing .map files for ROM/RAM optimization and memory budget, or diagnosing Keil-specific build failures. NOT for non-Keil build systems (Makefile, CMake, IAR, GCC-only). For crash triage see hardfault-triage."
---

<HARD-GATE>
This is a domain implementation skill. If you are planning, designing, or entering plan mode — load `Skill("embedded-workbench")` first to activate the workflow gates (Plan Verification Gate, Approval Gate, Closure Gate). Domain skills carry implementation guidance, not workflow enforcement.
</HARD-GATE>

# Keil MDK Build

Patterns for building embedded firmware with Keil MDK. Covers both ARM Compiler 5 (armcc) and ARM Compiler 6 (armclang).

## UV4 CLI Build (Authoritative)

UV4.exe batch mode is the canonical build path. The Python CLI reimplementation is useful for CI but may miss include paths.

```powershell
<Keil>\UV4\UV4.exe -b project.uvprojx -t TargetName -j0 -o <log_path>
```

Replace `<Keil>` with the Keil install root. Auto-discover by checking common locations or ask the user when unknown.

**Flags**:

| Flag | Meaning |
| ---- | ------- |
| `-b` | Batch mode (no GUI) |
| `-t <target>` | Target name within the multi-target project |
| `-j0` | Auto-parallelism (use all cores) |
| `-o <path>` | Log output file |

**Exit codes**:

| Code | Meaning |
| :--: | ------- |
| 0 | Success (no errors, no warnings) |
| 1 | Warnings but no errors |
| 2 | Errors |
| 3 | Errors (when `<StopOnExitCode>3</StopOnExitCode>` is set in uvprojx) |

**Critical: Log path resolution** — The `-o` path is resolved **relative to the `.uvprojx` file's directory**, not the current working directory. Always use an absolute path or a path under a known-existing subdirectory (e.g., `objects\`) of the project directory.

**Recommended invocation** — UV4 produces no stdout; use `Start-Process` with `-Wait -PassThru` and check `ExitCode`:

```powershell
$keil = "<Keil_install_root>"  # Ask user or auto-discover
$log = Join-Path (Get-Location) "build.log"
$p = Start-Process -FilePath "$keil\UV4\UV4.exe" `
    -ArgumentList "-b project.uvprojx -t Target -j0 -o $log" `
    -Wait -PassThru -NoNewWindow
if ($p.ExitCode -ne 0) { throw "Build failed (exit $($p.ExitCode))" }
```

## Compiler Selection

Keil MDK supports two compiler generations. Identify which one the project uses before generating commands.

| Compiler | Keil Name | Binary | Install Path | Check Version |
|----------|-----------|--------|-------------|---------------|
| ARM Compiler 5 | AC5 | `armcc` | `<Keil>\ARM\ARMCC` | `armcc --vsn` |
| ARM Compiler 6 | AC6 | `armclang` | `<Keil>\ARM\ARMCLANG*` | `armclang --version` |

**How to identify**: Check the `.uvprojx` XML for `<ARMCC>` (AC5) or `<ARMCLANG>` (AC6) sections. A project can mix both — check per-file or per-group settings.

## ARM Compiler 5 (armcc)

Legacy compiler, still common in long-lived projects. Uses its own flag syntax, incompatible with AC6.

**Detection**: Installed at `<Keil>\ARM\ARMCC`. Run `armcc --vsn` to verify.

**Optimization levels** — AC5 has two orthogonal axes: optimization level (`-On`) and optimization goal (`-Ospace` vs `-Otime`). Keil's UI combines them into a single dropdown:

| Keil Level | AC5 Flags (actual) | Effect |
| :----------: | -------------------- | -------- |
| 0 | `-O0` | Minimum optimization, best debug view |
| 1 | `-O1` | Restricted optimization, good debug view |
| 2 | `-O2` | High optimization (AC5 **default**) |
| 3 | `-O3` | Maximum optimization |
| 4 | `-O3 -Otime` | Max optimization + favor speed over size |

`-Ospace` is the default goal at levels 0-3 (favor smaller code). `-Otime` swaps to favor speed. These are separate from the `-On` level.

Sources: ARM Compiler v5.06 User Guide ([DUI0472M](https://developer.arm.com/documentation/dui0472m)), §3.154-3.159.

**Key flags**:

- `--cpu Cortex-M4` (adjust to target MCU; use `--cpu=list` to see supported targets)
- `--c99` or `--c11` (language standard; C90 is the AC5 default)
- `--gnu` (enable GNU extensions if project relies on them)
- `--apcs=/interwork` (ARM/Thumb interworking)
- `-c` (compile only, no link)
- `--split_sections` (equivalent to `-ffunction-sections -fdata-sections`)

**Warning control**: `--diag_suppress=<id>` to suppress specific warnings; `--diag_error=<id>` to promote to error.

## ARM Compiler 6 (armclang)

LLVM-based, current generation. Installed at `<Keil>\ARM\ARMCLANG*`.

**Detection**: Search common install roots for directories matching `ARMCLANG*`. Validate with `armclang --version`. If detection fails, ask the user.

**Optimization levels**:

| Keil Level | AC6 Flag |
| :----------: | ------ |
| 0 | `-O0` |
| 1 | `-O1` |
| 2 | `-O2` |
| 3 | `-O3` |
| 4 | `-Os` |
| 5 | `-Ofast` |

**Key flags for Cortex-M**:

- `--target=arm-arm-none-eabi -mcpu=cortex-m4 -mfpu=fpv4-sp-d16 -mfloat-abi=hard` (adjust MCU/FPU to target)
- `-c` (compile only, no link)
- `-ffunction-sections -fdata-sections` (enable linker garbage collection)
- `-fshort-enums -fshort-wchar` (common embedded defaults)

## AC5 to AC6 Migration Traps

Projects migrating from AC5 to AC6 commonly hit these issues. Sources: [ARM Compiler Migration Guide (DUI0742)](https://developer.arm.com/documentation/dui0742), [Arm Compiler for Embedded FuSa Migration Guide](https://developer.arm.com/documentation/109444).

| AC5 | AC6 | Trap |
| ----- | ----- | ------ |
| `__packed struct { ... }` | `struct __attribute__((packed, aligned(1))) { ... }` | AC5 keyword silently ignored by AC6; struct layout changes. `aligned(1)` ensures no implicit alignment. |
| `__irq void Handler()` | `void Handler(void) __attribute__((interrupt))` | AC5 attribute not recognized; ISR stack frame broken. Alternatively use CMSIS `IRQn_Type`. |
| `__asm { ... }` | `__asm volatile ("..." : : : )` | Inline assembly switches from armasm syntax to GAS (GNU assembler) syntax with GCC-style operand constraints. |
| `--c99` | `-std=c99` | Flag syntax differs; AC6 defaults to gnu11 |
| `--gnu` | `-fgnu89-inline` | GNU inline semantics differ between compilers |
| `--diag_suppress=<n>` | `-Wno-<name>` | Warning names differ; numbers don't map 1:1. Use AC6 `-Weverything` to list available warnings. |
| `#pragma diag_suppress` | `#pragma clang diagnostic ignored "-Wname"` | Pragma syntax differs |
| `char` unsigned by default | `-funsigned-char` | AC5 defaulted to `unsigned char`; AC6 defaults to signed. Add flag to preserve behavior. |

**Migration verification**: After switching compiler, compare `.map` file sizes and symbol lists. Unexpected size changes often indicate a packing or inlining difference.

## Build Lifecycle

A full Keil build has 5 stages:

1. **Pre-build** — Version header generation, manifest updates
2. **Compile** — `.c`/`.cpp`/`.s` → `.o` via armcc (AC5) or armclang (AC6)
3. **Link** — `armlink --via=<response>.lnp` → `.axf`
4. **Post-build (fromelf)** — `fromelf --bin objects/app.axf → application.bin`
5. **Post-build (merge)** — Merge application BIN + filesystem + bootloader into flash image

If bypassing UV4 (CI build), all 5 stages must be replicated. The Python CLI build tool handles this internally.

## Merge / Packaging

Embedded firmware packages typically merge multiple components into a single flash image.

### Bootloader Selection (Parity Rule)

A common pattern: use `version.build` parity to select development vs. production bootloader.

- Parse `version.build` as hexadecimal (not decimal)
- **Odd** → production bootloader
- **Even** → development bootloader

This is the most common source of confusion — `0x10` (hex) is even, even though "16" as a decimal number looks like it could be interpreted differently.

### Manifest Structure

Merged firmware images include a manifest at a fixed address with:

- Version fields (major, minor, patch, build)
- Component sizes (firmware, filesystem)
- CRC32 checksums for each component
- Magic number for validation

Components are typically padded to alignment boundaries before CRC calculation.

### Non-Standard CRC32

Embedded firmware CRC32 often differs from the standard `zlib`/`crc32` implementation:

- **Byte-swapped within each word** (MCU word order)
- No reflection (forward bit order)
- No final XOR
- Polynomial: `0x104C11DB7`

Verify the CRC implementation against a known-good reference before trusting any reimplementation.

## Common Build Failures

| Failure | Cause | Fix |
| --------- | ------- | ----- |
| UV4 log written to wrong location | `-o` path is relative to uvprojx directory | Use absolute path |
| CLI build: missing CMSIS headers | Pack directory detection incomplete | Use UV4 CLI (`UV4.exe -b`) for authoritative builds |
| CLI build: no compile entries | `.dep` file stale or from different target | Run Keil IDE build first to regenerate |
| merge: input file not found | fromelf step didn't produce `application.bin` | Check after-build hooks; ensure fromelf completed |
| Wrong bootloader selected | `version.build` parsed as decimal instead of hex | Always parse build number as hexadecimal |
| "file not found" for OTA component | Filesystem image not generated | Build filesystem assets before merge step |
| AC6: struct layout differs from AC5 | `__packed` ignored by AC6 | Replace with `__attribute__((packed))` |
| AC6: ISR crashes after migration | `__irq` attribute not recognized | Use `__attribute__((interrupt))` or CMSIS `IRQn_Type` |
| AC6: inline asm syntax errors | AC5 `__asm { }` in sources | Rewrite as `__asm volatile ("...")` |
| Linker: "No section matches selector" | Scatter file syntax differs between AC5/AC6 | Check scatter file against compiler docs; AC5 uses different section naming |

## MAP File Analysis

The `.map` file (at `<listings>/<target>.map`) is the linker's memory blueprint. Make it a habit to review after each build.

### Key Sections

| Section | What It Tells You |
| --------- | ------------------- |
| **Image component sizes** | Per-file Code / RO Data / RW Data / ZI Data breakdown. Find the bloat. |
| **Memory Map of the image** | Flash and RAM layout: load regions, execution regions, stack, heap |
| **Global Symbols** | Every function/variable address and size — essential for HardFault analysis |
| **Removing unused sections** | What the linker eliminated. Check for unexpected removals. |
| **Cross References** | Which `.o` calls which. Trace startup and verify call graphs. |

### Size Optimization Workflow

1. Sort **Image component sizes** by Code + RO Data. Focus on the top 5 files.
2. In **Global Symbols**, find functions with large `Size` values. Consider splitting or rewriting.
3. Check `.constdata` / `.rodata` for debug strings — guard with `#if` or move to runtime generation.
4. In **Memory Map**, look for `PAD` entries — these are alignment waste. Reorder struct members to minimize.
5. Verify MicroLIB is enabled; check that no accidental `printf`/`sprintf`/`malloc` drags in heavy library code.
6. Keep an optimization log: ROM/RAM before and after each change.

### Memory Budget Verification

From the **Memory Map** section:

- **Load Region LR_IROM1** size = total Flash used (Code + RO + RW initial values)
- **Execution Region RW_IRAM1** = total RAM used (RW data + ZI data + Stack + Heap)
- **RW Data** consumes BOTH Flash and RAM — initial values stored in Flash, copied to RAM at startup
- **ZI Data** consumes RAM only — zero-initialized at startup

Check that Stack + Heap sizes match the worst-case call chains (from `.htm` call graph) plus margin.

## HardFault / Exception Triage

For crash analysis — fault registers, stack-frame capture, PC-to-source resolution, root-cause classification — load `Skill("hardfault-triage")`. The `.map` file sections described above (Global Symbols, Memory Map) are the bridge between the two skills: build the `.map` here, debug the crash there.
