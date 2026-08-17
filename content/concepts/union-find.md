---
id: union-find
title: Union-Find
order: 10
tags: [자료구조, 그래프]
diagram: union-find-compress
---

"이 둘이 같은 그룹인가"를 거의 O(1)에 답하는 자료구조. 그룹을 **대표 원소 하나**로만 기억한다.

## 왜 배열 하나로 되는가

그룹을 집합으로 들고 있으면 합칠 때 원소를 옮겨야 한다. 대신 `parent[i]` — "나의 부모" 하나만
기억하면, 그룹은 부모를 계속 따라간 끝(루트)으로 자동 정의된다. 합치기는 **루트 하나를 다른 루트에
붙이는 한 줄**이 된다.

```java
int[] parent;

int find(int x) {
    while (parent[x] != x) x = parent[x];   // 재귀 금지 — 스택이 1MB뿐이다
    return x;
}

void union(int a, int b) {
    parent[find(a)] = find(b);
}
```

## 경로 압축이 진짜 핵심이다

위 코드만 쓰면 한 줄로 늘어진 트리가 만들어져 `find`가 O(N)이 된다. `find` 하는 김에
**지나온 노드를 전부 루트에 직결**시키면 다음부터 한 칸이다.

```java
int find(int x) {
    int root = x;
    while (parent[root] != root) root = parent[root];
    while (parent[x] != root) {          // 되짚어 올라가며 압축
        int next = parent[x];
        parent[x] = root;
        x = next;
    }
    return root;
}
```

두 번 순회하지만 상수배일 뿐이고, 한 번 압축한 경로는 다시 순회할 일이 없다.
이게 [[amortized-analysis]]가 말하는 "한 번 비싸고 그 다음은 공짜" 구조다.

## 언제 이걸 떠올리는가

- 간선을 하나씩 더하면서 사이클이 생기는지 봐야 할 때 → 크루스컬 MST
- 격자에서 같은 색 덩어리를 세는데 **덩어리가 계속 합쳐질 때**
- "합치기"만 있고 "쪼개기"는 없을 때 ← 이 조건이 깨지면 Union-Find는 못 쓴다

## 흔한 함정

| 함정 | 결과 |
|---|---|
| `find`를 재귀로 | 깊이가 깊어지면 StackOverflowError |
| 압축 없이 rank만 | 이론상 O(log N), 실측은 압축이 훨씬 크게 먹는다 |
| 테스트케이스마다 `parent` 재할당 | GC 압박. [[version-stamping]] 으로 초기화를 O(1)로 |
| `union(a, b)` 에서 `find` 안 하고 붙이기 | 트리가 아니라 사이클이 생긴다 |
