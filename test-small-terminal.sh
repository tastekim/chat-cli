#!/bin/bash

echo "=== 터미널 크기별 메시지 너비 테스트 ==="

# 다양한 터미널 크기로 테스트
sizes=(
  "40 20"   # 매우 작은 터미널
  "50 20"   # 작은 터미널
  "60 20"   # 중간 터미널
  "80 25"   # 표준 터미널
  "100 30"  # 큰 터미널
)

for size in "${sizes[@]}"; do
  width=$(echo $size | cut -d' ' -f1)
  height=$(echo $size | cut -d' ' -f2)
  
  echo ""
  echo "터미널 크기: ${width}x${height}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # 디버그 모드로 실행하여 너비 계산 정보 확인
  echo "Debug output:"
  timeout 3s bash -c "printf 'y\n\n' | COLUMNS=$width LINES=$height DEBUG=true node dist/index.js chat 2>&1 | grep 'Width Debug' | head -1"
  
  echo ""
done

echo ""
echo "테스트 완료. 실제 메시지가 사이드바를 침범하지 않는지 확인해보세요."