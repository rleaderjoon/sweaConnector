import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.StringTokenizer;

public class Main {
	public static void main(String[] args) throws Exception {
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		StringTokenizer st = new StringTokenizer(br.readLine());
		int n = Integer.parseInt(st.nextToken());
		int q = Integer.parseInt(st.nextToken());

		long[] sum = new long[n + 1];
		st = new StringTokenizer(br.readLine());
		for (int i = 1; i <= n; i++) {
			sum[i] = sum[i - 1] + Long.parseLong(st.nextToken());
		}

		StringBuilder sb = new StringBuilder();
		for (int k = 0; k < q; k++) {
			st = new StringTokenizer(br.readLine());
			int l = Integer.parseInt(st.nextToken());
			int r = Integer.parseInt(st.nextToken());
			sb.append(sum[r] - sum[l - 1]).append('\n');
		}
		System.out.print(sb);
	}
}
