#!/usr/bin/env python3
# Seed generator for DropSpot
# Usage: python scripts/generate_seed.py
# Outputs: 12-char hex seed and coefficients (A, B, C)

import hashlib
import subprocess
import sys
from datetime import datetime


def get_remote_url():
    # Get Git remote URL
    try:
        result = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Uyarı: Git remote URL bulunamadı. Manuel olarak girebilirsiniz.")
        return input("GitHub remote URL: ").strip()


def get_first_commit_epoch():
    # Get first commit epoch timestamp
    try:
        result = subprocess.run(
            ["git", "log", "--reverse", "--format=%ct"],
            capture_output=True,
            text=True,
            check=True
        )
        first_line = result.stdout.strip().split('\n')[0]
        if first_line:
            return first_line.strip()
        else:
            print("Uyarı: Commit bulunamadı. Şu anki zaman kullanılacak.")
            return str(int(datetime.now().timestamp()))
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Uyarı: Git log bulunamadı. Şu anki zaman kullanılacak.")
        return str(int(datetime.now().timestamp()))


def get_start_time():
    # Get start time in YYYYMMDDHHmm format
    now = datetime.now()
    return now.strftime("%Y%m%d%H%M")


def generate_seed(remote_url, first_commit_epoch, start_time):
    # Format: <remote_url>|<first_commit_epoch>|<start_time>
    # Seed = first 12 chars of SHA256
    raw = f"{remote_url}|{first_commit_epoch}|{start_time}"
    hash_digest = hashlib.sha256(raw.encode()).hexdigest()
    seed = hash_digest[:12]
    return seed, raw


def calculate_coefficients(seed):
    # Derive coefficients from seed
    # A = 7 + (int(seed[0:2],16) % 5)
    # B = 13 + (int(seed[2:4],16) % 7)
    # C = 3 + (int(seed[4:6],16) % 3)
    A = 7 + (int(seed[0:2], 16) % 5)
    B = 13 + (int(seed[2:4], 16) % 7)
    C = 3 + (int(seed[4:6], 16) % 3)
    return A, B, C


def main():
    print("=" * 60)
    print("DropSpot Seed Generator")
    print("=" * 60)
    print()
    
    # Başlangıç zamanını al (README'den veya kullanıcıdan)
    start_time = get_start_time()
    print(f"Başlangıç zamanı (YYYYMMDDHHmm): {start_time}")
    
    # Remote URL'i al
    remote_url = get_remote_url()
    print(f"Remote URL: {remote_url}")
    
    # İlk commit epoch'unu al
    first_commit_epoch = get_first_commit_epoch()
    print(f"İlk commit epoch: {first_commit_epoch}")
    print()
    
    # Seed üret
    seed, raw_input = generate_seed(remote_url, first_commit_epoch, start_time)
    
    print("=" * 60)
    print("SONUÇLAR")
    print("=" * 60)
    print(f"Raw input: {raw_input}")
    print(f"Seed (12 karakter): {seed}")
    print()
    
    # Katsayıları hesapla
    A, B, C = calculate_coefficients(seed)
    print("Katsayılar:")
    print(f"  A = {A}")
    print(f"  B = {B}")
    print(f"  C = {C}")
    print()
    
    print("=" * 60)
    print("Priority Score Formülü (Örnek)")
    print("=" * 60)
    print(f"priority_score = base + (signup_latency_ms % {A}) + (account_age_days % {B}) - (rapid_actions % {C})")
    print()
    print("Not: Bu katsayılar backend servisinde kullanılacaktır.")
    print("Seed ve katsayıları .env veya config dosyasına ekleyin.")
    print("=" * 60)
    
    return seed, A, B, C


if __name__ == "__main__":
    try:
        seed, A, B, C = main()
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n\nİşlem iptal edildi.")
        sys.exit(1)
    except Exception as e:
        print(f"\nHata: {e}", file=sys.stderr)
        sys.exit(1)

