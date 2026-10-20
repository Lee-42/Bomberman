#!/bin/zsh
cd "${0:A:h}" || exit 1
if [[ ! -f build/web-desktop/index.html ]]; then
  print '尚未构建。请在工程目录执行 npm run build:web。'
  exit 1
fi
stage_port=$(python3 - <<'PY'
import socket
for port in range(8770,8781):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1',port))
            print(port)
            break
        except OSError:
            continue
else:
    raise SystemExit('8770–8780 端口均已占用')
PY
) || exit 1
print "本地试玩地址：http://127.0.0.1:${stage_port}/"
print 'Enter 开始，方向键/WASD 移动，空格放弹，B 遥控引爆，P 暂停，R 重开，M 静音，TAB 菜单/选择。'
print '本版本包含 50 个普通关卡和 9 个奖励关。关闭此终端窗口或按 Control+C 停止服务。'
python3 -m http.server "$stage_port" --bind 127.0.0.1 --directory build/web-desktop &
stage_server_pid=$!
trap 'kill "$stage_server_pid" 2>/dev/null' EXIT INT TERM
for attempt in {1..30}; do
  if curl --silent --fail "http://127.0.0.1:${stage_port}/" >/dev/null; then
    open "http://127.0.0.1:${stage_port}/"
    break
  fi
  sleep 0.1
done
wait "$stage_server_pid"
