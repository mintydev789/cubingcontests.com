type Props = {
  loadingEntity?: string;
  reason?: string;
};

function LoadingError({ loadingEntity = "data", reason }: Props) {
  return (
    <section>
      <h4 className="mt-4 text-center">Error while loading {loadingEntity}</h4>

      {reason && <p className="mt-4 text-center">(reason: {reason})</p>}
    </section>
  );
}

export default LoadingError;
