# Operator verify: stomp assignment SET `114d`

Decode from dump is locked. Live `0D` bit map (Footswitch A) is locked.

## Live `0D` mask (Footswitch A)

| Byte | Field | Bits |
| --- | --- | --- |
| 13 | m0 | CAB=1, EQ=2, MOD=4, DLY=8 |
| 14 | m1 | NR=1, PRE=2, DST=4, AMP=8 |
| 15 | pad | `00` |
| 16 | m3 | RVB=1, NS=2 |

Max 3 effects per foot; 4th ignored.

## Write hypotheses

| ID | Idea | Result |
| --- | --- | --- |
| H7–H9 | short / padded per-effect | wrong map / foot collisions |
| H10 | foot + packed low/high | off reacts; scrambled |
| H11 | foot + m0,m1,00,m3 | pattern: foot=1→NR A; m0→m3 A; m3→m1 B |
| **H12** | **both masks, no foot** (`size 0A`: A then B as m0,m1,00,m3) | under test |

Retest A: NR on/off; PRE; CAB; clear. B should not get ghost NR from A edits.
