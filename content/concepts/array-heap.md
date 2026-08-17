---
id: array-heap
title: 배열 힙 (직접 구현)
order: 20
tags: [자료구조, 정렬]
diagram: array-heap
---

우선순위 큐를 `int[]` 하나로 만든다. 표준 라이브러리 우선순위 큐가 느린 이유와, 직접 만들면
왜 빨라지는지가 이 항목의 전부다.

## 트리를 배열에 눕히는 규칙

완전 이진 트리는 노드를 위에서 아래로, 왼쪽에서 오른쪽으로 번호를 매기면 배열 인덱스와 정확히 겹친다.

```
자식 = 2i+1, 2i+2        부모 = (i-1)/2
```

포인터가 필요 없다. 인덱스 산술이 포인터를 대체한다.

## 왜 직접 만드는가

| 표준 우선순위 큐 | 배열 힙 |
|---|---|
| 원소마다 객체 할당 | 할당 없음 |
| 정수를 넣을 때 오토박싱 | 원시 int 그대로 |
| 비교 때마다 비교자 함수 호출 | 부등호 한 줄 |
| 캐시 미스 (노드가 힙 메모리에 흩어짐) | 연속 메모리 순차 접근 |

같은 O(log N)인데 실측이 3~10배 갈린다. [[big-o-constants]] 가 말하는 "상수를 무시하면
안 되는 순간"이 바로 이런 곳이다.

## 최소 힙 골격

```java
int[] heap = new int[MAX];
int size = 0;

void push(int v) {
    int i = size++;
    heap[i] = v;
    while (i > 0) {                      // 위로 올리기
        int p = (i - 1) >> 1;
        if (heap[p] <= heap[i]) break;
        int t = heap[p]; heap[p] = heap[i]; heap[i] = t;
        i = p;
    }
}

int pop() {
    int top = heap[0];
    heap[0] = heap[--size];
    int i = 0;
    while (true) {                       // 아래로 내리기
        int l = 2 * i + 1, r = l + 1, m = i;
        if (l < size && heap[l] < heap[m]) m = l;
        if (r < size && heap[r] < heap[m]) m = r;
        if (m == i) break;
        int t = heap[m]; heap[m] = heap[i]; heap[i] = t;
        i = m;
    }
    return top;
}
```

## 두 값을 함께 담아야 할 때

최단경로처럼 `(거리, 노드)` 쌍이 필요하면 배열을 두 개 쓰거나, 값을 하나로 눌러 담는다.

```java
long packed = ((long) dist << 32) | node;   // 상위 32비트로 정렬이 그대로 된다
```

거리가 `2^31` 미만이고 노드 번호가 음수가 아니면 이 방식이 안전하고 가장 빠르다.
`long` 하나를 비교하는 것으로 두 키 비교가 끝난다.

## 흔한 함정

- `pop()` 에서 `heap[0] = heap[--size]` 를 잊고 내리기만 하면 마지막 원소가 사라진다
- 배열 크기를 실제 push 최대 횟수로 잡아야 한다 — 노드 수가 아니라 **간선 수**인 경우가 많다
- 테스트케이스마다 `size = 0` 만 하면 된다. 배열을 지울 필요는 없다 ([[version-stamping]] 과 같은 논리)
