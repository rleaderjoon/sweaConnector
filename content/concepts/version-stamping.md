---
id: version-stamping
title: 버전 태깅으로 O(1) 초기화
order: 40
tags: [최적화, 자료구조]
diagram: version-stamping
---

테스트케이스마다 큰 배열을 지우는 비용을 없앤다. 배열을 지우는 대신 **"언제 쓴 값인지"를 함께
기억**하고, 세대 번호가 다르면 없는 값으로 취급한다.

## 문제 상황

테스트케이스 50개, 각 케이스마다 `visited` 배열을 초기화한다고 하자.

```java
void init(int n) {
    Arrays.fill(visited, false);      // O(N)
}
```

N이 1,000,000이면 초기화만 5천만 번이다. 실제 방문하는 칸은 케이스당 수백 개일 수도 있는데,
쓰지도 않은 칸을 지우느라 시간을 쓴다.

## 해법

```java
int[] stamp = new int[N];      // 0 으로 시작
int gen = 0;

void init(int n) {
    gen++;                     // 이게 전체 초기화다. O(1)
}

boolean visited(int i) {
    return stamp[i] == gen;
}

void visit(int i) {
    stamp[i] = gen;
}
```

`stamp[i]` 에 남아 있는 값은 이전 세대의 흔적이다. `gen` 과 다르면 그냥 무시하면 되니 지울 필요가 없다.
`boolean` 하나가 `int` 하나로 커지는 대신, 초기화가 O(N) 에서 O(1) 로 내려간다.

## 값을 함께 들고 있어야 할 때

방문 여부가 아니라 값(예: 최단거리)을 들고 있어야 하면 배열 두 개를 나란히 둔다.

```java
int[] stamp = new int[N];
int[] dist  = new int[N];

int get(int i)          { return stamp[i] == gen ? dist[i] : INF; }
void set(int i, int v)  { stamp[i] = gen; dist[i] = v; }
```

`get` 이 세대를 확인해 주기 때문에 `dist` 는 영원히 지우지 않아도 된다.

## 주의할 점

- `gen` 을 절대 0으로 되돌리지 않는다. `stamp` 의 초기값 0과 충돌한다
- 세대 번호가 `int` 를 넘칠 일은 없다 (케이스가 21억 개가 아니라면)
- 배열을 다시 `new` 하지 않는다 — 그러면 GC 가 일하게 되고, O(1) 초기화의 이점이 사라진다
- 같은 논리가 [[array-heap]] 의 `size = 0` 이나 [[union-find]] 의 `parent` 재사용에도 적용된다

## 언제 쓰지 않는가

케이스가 한두 개거나 배열이 작으면 그냥 `Arrays.fill` 이 낫다. 코드가 짧고 읽기 쉽다.
이 기법은 "초기화 비용이 실제 작업량보다 큰" 상황에서만 이득이다 — 그걸 확인하지 않고 쓰면
[[big-o-constants]] 를 반대 방향으로 오해한 것이다.
