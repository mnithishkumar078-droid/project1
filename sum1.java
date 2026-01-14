import java.util.*;
public class sum1{
    public static void main(String args[]){
        System.out.print("Enter the number is :");
        Scanner n=new Scanner(System.in);
        int p=n.nextInt();
        int s=0,d=0;
        while(p>0){
            int r=p%10;
            s=s+r;
            p=p/10;
            } while (s>0) {
               int r=s%10;
            d=d+r;
            s=s/10;
            }
            System.out.print(d);
            n.close();
        }

        
    }
