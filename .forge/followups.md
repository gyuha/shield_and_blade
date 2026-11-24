# Follow-ups

<!-- followup: fu-5b1e0c7a9d21 | source: combat-core-1of3 | task: 1 | date: 2026-11-25 | status: open | taken: - -->
- 사람 플레이 기준 난이도 조정: 패링 윈도 0.15초와 보스 체력 700이 사람에게 적절한지 직접 플레이로 확인.
  Evidence: 수치는 봇 기준으로만 맞췄고(숙련 봇 피격 0회), 사람 플레이 측정은 없음.

<!-- followup: fu-8c2f4a61e0b3 | source: playable-3d-duel-2of3 | task: 2 | date: 2026-11-25 | status: open | taken: - -->
- 게임패드 조작을 실제 기기로 확인하고, 플레이어 캐릭터가 배경에서 더 잘 보이도록 조명·색을 조정.
  Evidence: 게임패드는 헤드리스 검사에서 실행되지 않았고, 스크린샷에서 플레이어가 어둡게 보임.

<!-- followup: fu-1d7e93b5a4c6 | source: playable-3d-duel-2of3 | task: 2 | date: 2026-11-25 | status: open | taken: - -->
- 배포용으로 three를 `vendor/`에 복사하는 단계 추가(정적 호스팅은 `node_modules`를 올리지 않음).
  Evidence: `index.html`의 importmap이 `./node_modules/three/...`를 가리킴.
